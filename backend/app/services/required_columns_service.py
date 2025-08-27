# backend/app/services/required_column_service.py
from typing import List, Optional, cast
from fastapi import HTTPException, status
from sqlmodel import select, Session
from app.models.required_columns import RequiredColumn
from app.schemas.required_columns import RequiredColumnCreate, RequiredColumnUpdate


def get_all(db: Session, client_id: Optional[int] = None) -> List[RequiredColumn]:
    stmt = select(RequiredColumn)
    if client_id is not None:
        stmt = stmt.where(RequiredColumn.client_id == client_id)
    results = db.exec(stmt)
    items = results.all()
    return cast(List[RequiredColumn], items)


def get_by_id(db: Session, required_id: int) -> RequiredColumn:
    stmt = select(RequiredColumn).where(RequiredColumn.required_id == required_id)
    result = db.exec(stmt).one_or_none()
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Required column not found"
        )
    return result


def create(db: Session, payload: RequiredColumnCreate) -> RequiredColumn:
    missing = []
    if not getattr(payload, "client_id", None):
        missing.append("client_id")
    if not getattr(payload, "column_name", None):
        missing.append("column_name")
    if missing:
        raise HTTPException(
            status_code=422, detail=f"Missing required fields: {', '.join(missing)}"
        )

    obj = RequiredColumn(**payload.dict())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def batch_add(
    db: Session, payloads: List[RequiredColumnCreate]
) -> List[RequiredColumn]:
    created = []
    for p in payloads:
        if not getattr(p, "client_id", None) or not getattr(p, "column_name", None):
            raise HTTPException(
                status_code=422,
                detail="Each required column must include client_id and column_name",
            )
        obj = RequiredColumn(**p.dict())
        db.add(obj)
        created.append(obj)

    db.commit()
    for obj in created:
        db.refresh(obj)
    return created


def update(
    db: Session, required_id: int, payload: RequiredColumnUpdate
) -> RequiredColumn:
    obj = get_by_id(db, required_id)
    data = payload.dict(exclude_unset=True)

    if "client_id" in data and not data.get("client_id"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="client_id cannot be empty",
        )
    if "column_name" in data and not data.get("column_name"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="column_name cannot be empty",
        )

    for k, v in data.items():
        setattr(obj, k, v)

    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def delete(db: Session, required_id: int) -> None:
    obj = get_by_id(db, required_id)
    db.delete(obj)
    db.commit()
