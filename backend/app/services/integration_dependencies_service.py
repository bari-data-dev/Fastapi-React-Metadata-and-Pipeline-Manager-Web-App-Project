from typing import List, Optional, cast
from fastapi import HTTPException, status
from sqlmodel import select, Session
from app.models.integration_dependencies import IntegrationDependency
from app.schemas.integration_dependencies import (
    IntegrationDependencyCreate,
    IntegrationDependencyUpdate,
)


def get_all(
    db: Session, client_id: Optional[int] = None
) -> List[IntegrationDependency]:
    stmt = select(IntegrationDependency)
    if client_id is not None:
        stmt = stmt.where(IntegrationDependency.client_id == client_id)
    results = db.exec(stmt)
    return cast(List[IntegrationDependency], results.all())


def get_by_id(db: Session, dependency_id: int) -> IntegrationDependency:
    stmt = select(IntegrationDependency).where(
        IntegrationDependency.dependency_id == dependency_id
    )
    result = db.exec(stmt).one_or_none()
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration dependency not found",
        )
    return result


def create(db: Session, payload: IntegrationDependencyCreate) -> IntegrationDependency:
    if (
        not getattr(payload, "client_id", None)
        or not getattr(payload, "fact_proc_name", None)
        or not getattr(payload, "dim_proc_name", None)
    ):
        raise HTTPException(status_code=422, detail="Missing required fields")
    obj = IntegrationDependency(**payload.dict())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def batch_add(
    db: Session, payloads: List[IntegrationDependencyCreate]
) -> List[IntegrationDependency]:
    created = []
    for p in payloads:
        if (
            not getattr(p, "client_id", None)
            or not getattr(p, "fact_proc_name", None)
            or not getattr(p, "dim_proc_name", None)
        ):
            raise HTTPException(
                status_code=422,
                detail="Each item must include client_id, fact_proc_name, dim_proc_name",
            )
        obj = IntegrationDependency(**p.dict())
        db.add(obj)
        created.append(obj)
    db.commit()
    for obj in created:
        db.refresh(obj)
    return created


def update(
    db: Session, dependency_id: int, payload: IntegrationDependencyUpdate
) -> IntegrationDependency:
    obj = get_by_id(db, dependency_id)
    data = payload.dict(exclude_unset=True)

    if "client_id" in data and not data.get("client_id"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="client_id cannot be empty",
        )

    for k, v in data.items():
        setattr(obj, k, v)

    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def delete(db: Session, dependency_id: int) -> None:
    obj = get_by_id(db, dependency_id)
    db.delete(obj)
    db.commit()
