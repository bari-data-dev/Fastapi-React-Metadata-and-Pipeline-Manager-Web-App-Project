# backend/app/services/mv_refresh_service.py
from typing import List, Optional, cast
from sqlmodel import Session, select
from datetime import datetime

from app.models.mv_refresh import MvRefreshConfig
from app.schemas.mv_refresh import MvRefreshConfigCreate, MvRefreshConfigUpdate


def get_all_mv_refresh_configs(
    db: Session, client_id: Optional[int] = None
) -> List[MvRefreshConfig]:
    stmt = select(MvRefreshConfig)
    if client_id is not None:
        stmt = stmt.where(MvRefreshConfig.client_id == client_id)
    results = db.exec(stmt)
    return cast(List[MvRefreshConfig], results.all())


def get_mv_refresh_config(db: Session, mv_id: int) -> Optional[MvRefreshConfig]:
    return db.get(MvRefreshConfig, mv_id)


def create_mv_refresh_config(
    db: Session, payload: MvRefreshConfigCreate
) -> MvRefreshConfig:
    obj = MvRefreshConfig(
        client_id=payload.client_id,
        mv_proc_name=payload.mv_proc_name,
        is_active=payload.is_active if payload.is_active is not None else True,
        refresh_mode=payload.refresh_mode,
        created_at=datetime.utcnow(),
        created_by=payload.created_by or "system",
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def batch_create_mv_refresh_configs(
    db: Session, payloads: List[MvRefreshConfigCreate]
) -> List[MvRefreshConfig]:
    objs = []
    for p in payloads:
        obj = MvRefreshConfig(
            client_id=p.client_id,
            mv_proc_name=p.mv_proc_name,
            is_active=p.is_active if p.is_active is not None else True,
            refresh_mode=p.refresh_mode,
            created_at=datetime.utcnow(),
            created_by=p.created_by or "system",
        )
        db.add(obj)
        objs.append(obj)
    db.commit()
    # refresh each to get generated PKs
    for o in objs:
        db.refresh(o)
    return objs


def update_mv_refresh_config(
    db: Session, mv_id: int, payload: MvRefreshConfigUpdate
) -> Optional[MvRefreshConfig]:
    obj = db.get(MvRefreshConfig, mv_id)
    if not obj:
        return None
    update_data = payload.dict(exclude_unset=True)
    for k, v in update_data.items():
        setattr(obj, k, v)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def delete_mv_refresh_config(db: Session, mv_id: int) -> bool:
    obj = db.get(MvRefreshConfig, mv_id)
    if not obj:
        return False
    db.delete(obj)
    db.commit()
    return True
