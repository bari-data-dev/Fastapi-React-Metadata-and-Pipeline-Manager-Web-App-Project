# backend/app/services/client_service.py
from typing import List, Optional, cast
from fastapi import HTTPException, status
from sqlmodel import select, Session
from app.models.client import ClientReference
from app.schemas.client import ClientCreate, ClientUpdate

DEFAULT_BATCH = "BATCH000000"


def _ensure_last_batch(data: dict) -> dict:
    """
    Ensure last_batch_id present and non-empty. If missing or empty, set default.
    Operates on a dict (mutable) and returns it.
    """
    if "last_batch_id" not in data or data.get("last_batch_id") is None:
        data["last_batch_id"] = DEFAULT_BATCH
    else:
        # if empty string or whitespace -> set default
        val = data.get("last_batch_id")
        if isinstance(val, str) and val.strip() == "":
            data["last_batch_id"] = DEFAULT_BATCH
    return data


def get_all(db: Session, client_id: Optional[int] = None) -> List[ClientReference]:
    stmt = select(ClientReference)
    if client_id is not None:
        stmt = stmt.where(ClientReference.client_id == client_id)
    results = db.exec(stmt)
    items = results.all()
    return cast(List[ClientReference], items)


def get_by_id(db: Session, client_id: int) -> ClientReference:
    stmt = select(ClientReference).where(ClientReference.client_id == client_id)
    result = db.exec(stmt).one_or_none()
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Client not found"
        )
    return result


def create(db: Session, payload: ClientCreate) -> ClientReference:
    # required fields: client_schema, client_name
    missing = []
    if not getattr(payload, "client_schema", None):
        missing.append("client_schema")
    if not getattr(payload, "client_name", None):
        missing.append("client_name")
    if missing:
        raise HTTPException(
            status_code=422, detail=f"Missing required fields: {', '.join(missing)}"
        )

    data = payload.dict()
    _ensure_last_batch(data)

    obj = ClientReference(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def batch_add(db: Session, payloads: List[ClientCreate]) -> List[ClientReference]:
    """
    Create multiple ClientReference rows in a single request.
    Each payload must include client_schema and client_name.
    If last_batch_id missing/empty, will be set to DEFAULT_BATCH.
    """
    created = []
    for p in payloads:
        # validate minimal required fields
        if not getattr(p, "client_schema", None) or not getattr(p, "client_name", None):
            raise HTTPException(
                status_code=422,
                detail="Each client must include client_schema and client_name",
            )
        data = p.dict()
        _ensure_last_batch(data)
        obj = ClientReference(**data)
        db.add(obj)
        created.append(obj)

    db.commit()
    for obj in created:
        db.refresh(obj)
    return created


def update(db: Session, client_id: int, payload: ClientUpdate) -> ClientReference:
    obj = get_by_id(db, client_id)
    data = payload.dict(exclude_unset=True)

    # If last_batch_id present in update and is empty/None -> set default
    if "last_batch_id" in data:
        val = data.get("last_batch_id")
        if val is None or (isinstance(val, str) and val.strip() == ""):
            data["last_batch_id"] = DEFAULT_BATCH

    for k, v in data.items():
        setattr(obj, k, v)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def delete(db: Session, client_id: int) -> None:
    obj = get_by_id(db, client_id)
    db.delete(obj)
    db.commit()
