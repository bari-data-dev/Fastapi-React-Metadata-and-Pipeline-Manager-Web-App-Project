from typing import List, Optional, cast
from fastapi import HTTPException, status
from sqlmodel import select, Session

from app.models.column_mapping import ColumnMapping
from app.schemas.column_mapping import ColumnMappingCreate, ColumnMappingUpdate


def get_all(db: Session, client_id: Optional[int] = None) -> List[ColumnMapping]:
    stmt = select(ColumnMapping)
    if client_id is not None:
        stmt = stmt.where(ColumnMapping.client_id == client_id)
    results = db.exec(stmt)
    items = results.all()
    return cast(List[ColumnMapping], items)


def get_by_id(db: Session, mapping_id: int) -> ColumnMapping:
    stmt = select(ColumnMapping).where(ColumnMapping.mapping_id == mapping_id)
    result = db.exec(stmt).one_or_none()
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Mapping not found"
        )
    return result


def create(db: Session, payload: ColumnMappingCreate) -> ColumnMapping:
    # validate required fields (client_id, source_column, target_column)
    missing = []
    if not getattr(payload, "client_id", None):
        missing.append("client_id")
    if not getattr(payload, "source_column", None):
        missing.append("source_column")
    if not getattr(payload, "target_column", None):
        missing.append("target_column")
    if missing:
        raise HTTPException(
            status_code=422, detail=f"Missing required fields: {', '.join(missing)}"
        )

    obj = ColumnMapping(**payload.dict())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def batch_add(db: Session, payloads: List[ColumnMappingCreate]) -> List[ColumnMapping]:
    created = []
    for p in payloads:
        if (
            not getattr(p, "client_id", None)
            or not getattr(p, "source_column", None)
            or not getattr(p, "target_column", None)
        ):
            raise HTTPException(
                status_code=422,
                detail="Each mapping must include client_id, source_column and target_column",
            )
        obj = ColumnMapping(**p.dict())
        db.add(obj)
        created.append(obj)

    db.commit()
    for obj in created:
        db.refresh(obj)
    return created


def update(db: Session, mapping_id: int, payload: ColumnMappingUpdate) -> ColumnMapping:
    obj = get_by_id(db, mapping_id)
    data = payload.dict(exclude_unset=True)
    for k, v in data.items():
        setattr(obj, k, v)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def delete(db: Session, mapping_id: int) -> None:
    obj = get_by_id(db, mapping_id)
    db.delete(obj)
    db.commit()
