# backend/app/services/transformation_config_service.py
from typing import List, Optional, cast
from fastapi import HTTPException, status
from sqlmodel import select, Session
from app.models.transformation_config import TransformationConfig
from app.schemas.transformation_config import (
    TransformationConfigCreate,
    TransformationConfigUpdate,
)


def get_all(db: Session, client_id: Optional[int] = None) -> List[TransformationConfig]:
    stmt = select(TransformationConfig)
    if client_id is not None:
        stmt = stmt.where(TransformationConfig.client_id == client_id)
    results = db.exec(stmt)
    items = results.all()
    return cast(List[TransformationConfig], items)


def get_by_id(db: Session, transform_id: int) -> TransformationConfig:
    stmt = select(TransformationConfig).where(
        TransformationConfig.transform_id == transform_id
    )
    result = db.exec(stmt).one_or_none()
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transformation config not found",
        )
    return result


def create(db: Session, payload: TransformationConfigCreate) -> TransformationConfig:
    missing = []
    if not getattr(payload, "client_id", None):
        missing.append("client_id")
    if not getattr(payload, "proc_name", None):
        missing.append("proc_name")
    if missing:
        raise HTTPException(
            status_code=422, detail=f"Missing required fields: {', '.join(missing)}"
        )

    obj = TransformationConfig(**payload.dict())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def batch_add(
    db: Session, payloads: List[TransformationConfigCreate]
) -> List[TransformationConfig]:
    created: List[TransformationConfig] = []
    for p in payloads:
        if not getattr(p, "client_id", None) or not getattr(p, "proc_name", None):
            raise HTTPException(
                status_code=422,
                detail="Each transformation config must include client_id and proc_name",
            )
        obj = TransformationConfig(**p.dict())
        # optionally set created_at / created_by here if needed
        db.add(obj)
        created.append(obj)

    db.commit()
    for obj in created:
        db.refresh(obj)
    return created


def update(
    db: Session, transform_id: int, payload: TransformationConfigUpdate
) -> TransformationConfig:
    obj = get_by_id(db, transform_id)
    data = payload.dict(exclude_unset=True)
    # simple validation: if client_id passed but falsy -> reject
    if "client_id" in data and (data.get("client_id") is None):
        raise HTTPException(status_code=422, detail="client_id cannot be empty")
    for k, v in data.items():
        setattr(obj, k, v)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def delete(db: Session, transform_id: int) -> None:
    obj = get_by_id(db, transform_id)
    db.delete(obj)
    db.commit()
