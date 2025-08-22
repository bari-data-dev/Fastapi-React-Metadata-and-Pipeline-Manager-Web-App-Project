# backend/app/services/integrations_service.py
from typing import List, Optional, cast
from fastapi import HTTPException, status
from sqlmodel import select, Session
from app.models.integration_config import IntegrationConfig
from app.schemas.integration_config import (
    IntegrationConfigCreate,
    IntegrationConfigUpdate,
)


def get_all(db: Session, client_id: Optional[int] = None) -> List[IntegrationConfig]:
    stmt = select(IntegrationConfig)
    if client_id is not None:
        stmt = stmt.where(IntegrationConfig.client_id == client_id)
    results = db.exec(stmt)
    items = results.all()
    return cast(List[IntegrationConfig], items)


def get_by_id(db: Session, integration_id: int) -> IntegrationConfig:
    stmt = select(IntegrationConfig).where(
        IntegrationConfig.integration_id == integration_id
    )
    result = db.exec(stmt).one_or_none()
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Integration config not found"
        )
    return result


def create(db: Session, payload: IntegrationConfigCreate) -> IntegrationConfig:
    missing = []
    if not getattr(payload, "client_id", None):
        missing.append("client_id")
    if not getattr(payload, "proc_name", None):
        missing.append("proc_name")
    if missing:
        raise HTTPException(
            status_code=422, detail=f"Missing required fields: {', '.join(missing)}"
        )

    obj = IntegrationConfig(**payload.dict())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def batch_add(
    db: Session, payloads: List[IntegrationConfigCreate]
) -> List[IntegrationConfig]:
    created = []
    for p in payloads:
        if not getattr(p, "client_id", None) or not getattr(p, "proc_name", None):
            raise HTTPException(
                status_code=422,
                detail="Each integration config must include client_id and proc_name",
            )
        obj = IntegrationConfig(**p.dict())
        db.add(obj)
        created.append(obj)

    db.commit()
    for obj in created:
        db.refresh(obj)
    return created


def update(
    db: Session, integration_id: int, payload: IntegrationConfigUpdate
) -> IntegrationConfig:
    obj = get_by_id(db, integration_id)
    data = payload.dict(exclude_unset=True)
    # validation: if client_id provided must be truthy
    if "client_id" in data and (data.get("client_id") is None):
        raise HTTPException(status_code=422, detail="client_id cannot be empty")
    for k, v in data.items():
        setattr(obj, k, v)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def delete(db: Session, integration_id: int) -> None:
    obj = get_by_id(db, integration_id)
    db.delete(obj)
    db.commit()
