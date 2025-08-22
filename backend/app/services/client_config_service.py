# backend/app/services/client_config_service.py
from typing import List, Optional, cast
from sqlmodel import select, Session
from fastapi import HTTPException, status

from app.models.client_config import ClientConfig
from app.schemas.client_config import (
    ClientConfigCreate,
    ClientConfigUpdate,
    BatchConfigSaveRequest,
)


def get_all(db: Session, client_id: Optional[int] = None) -> List[ClientConfig]:
    stmt = select(ClientConfig)
    if client_id is not None:
        stmt = stmt.where(ClientConfig.client_id == client_id)
    results = db.exec(stmt)
    items = results.all()
    return cast(List[ClientConfig], items)


def get_by_id(db: Session, config_id: int) -> ClientConfig:
    stmt = select(ClientConfig).where(ClientConfig.config_id == config_id)
    result = db.exec(stmt).one_or_none()
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Configuration not found"
        )
    return result


def _validate_cfg_minimal(cfg: ClientConfigCreate) -> None:
    missing = []
    if not getattr(cfg, "client_id", None):
        missing.append("client_id")
    if not getattr(cfg, "source_type", None):
        missing.append("source_type")
    if not getattr(cfg, "target_schema", None):
        missing.append("target_schema")
    if not getattr(cfg, "target_table", None):
        missing.append("target_table")
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Missing required fields in client config: {', '.join(missing)}",
        )


def batch_save(db: Session, request: BatchConfigSaveRequest) -> List[ClientConfig]:
    """
    Save multiple ClientConfig rows in a single request.
    Each payload must include client_id, source_type, target_schema, target_table.
    """
    new_objs: List[ClientConfig] = []
    try:
        for cfg in request.client_configs:
            _validate_cfg_minimal(cfg)
            data = cfg.dict()
            # Accept config_version if provided per item; we don't enforce a batch-level version
            obj = ClientConfig(**data)
            db.add(obj)
            new_objs.append(obj)

        db.commit()

        for obj in new_objs:
            db.refresh(obj)

        return new_objs

    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save configurations: {str(exc)}",
        )


def update(db: Session, config_id: int, payload: ClientConfigUpdate) -> ClientConfig:
    obj = get_by_id(db, config_id)
    data = payload.dict(exclude_unset=True)
    # simple validation: cannot set empty strings for required fields
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


def delete(db: Session, config_id: int) -> None:
    obj = get_by_id(db, config_id)
    db.delete(obj)
    db.commit()
