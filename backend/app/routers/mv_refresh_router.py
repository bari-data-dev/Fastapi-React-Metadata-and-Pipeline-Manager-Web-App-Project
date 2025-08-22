# backend/app/routers/mv_refresh_router.py
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Path, status
from sqlmodel import Session

from app.db.database import get_session
from app.schemas.mv_refresh import (
    MvRefreshConfigCreate,
    MvRefreshConfigRead,
    MvRefreshConfigUpdate,
)
from app.services import mv_refresh_service
from app.types import ApiResponse

router = APIRouter(prefix="/mv-refresh-configs", tags=["MV Refresh Configs"])


@router.get("", response_model=ApiResponse[List[MvRefreshConfigRead]])
def list_mv_refresh_configs(
    client_id: Optional[int] = Query(None, description="Filter by client_id"),
    db: Session = Depends(get_session),
):
    items = mv_refresh_service.get_all_mv_refresh_configs(db, client_id)
    return ApiResponse(success=True, data=items)


@router.get("/{mv_id}", response_model=ApiResponse[MvRefreshConfigRead])
def get_mv_refresh_config(
    mv_id: int = Path(..., description="MV refresh config id"),
    db: Session = Depends(get_session),
):
    item = mv_refresh_service.get_mv_refresh_config(db, mv_id)
    return ApiResponse(success=True, data=item)


@router.post(
    "",
    response_model=ApiResponse[MvRefreshConfigRead],
    status_code=status.HTTP_201_CREATED,
)
def create_mv_refresh_config(
    payload: MvRefreshConfigCreate, db: Session = Depends(get_session)
):
    created = mv_refresh_service.create_mv_refresh_config(db, payload)
    return ApiResponse(success=True, data=created, message="MV refresh config created")


@router.post(
    "/batch-add",
    response_model=ApiResponse[List[MvRefreshConfigRead]],
    status_code=status.HTTP_201_CREATED,
)
def batch_add_mv_refresh_configs(
    payloads: List[MvRefreshConfigCreate],
    db: Session = Depends(get_session),
):
    if not isinstance(payloads, list) or len(payloads) == 0:
        return ApiResponse(
            success=False, data=[], message="payloads must be non-empty list"
        )
    created = mv_refresh_service.batch_create_mv_refresh_configs(db, payloads)
    return ApiResponse(
        success=True, data=created, message=f"{len(created)} MV refresh configs created"
    )


@router.put("/{mv_id}", response_model=ApiResponse[MvRefreshConfigRead])
def update_mv_refresh_config(
    mv_id: int,
    payload: MvRefreshConfigUpdate,
    db: Session = Depends(get_session),
):
    updated = mv_refresh_service.update_mv_refresh_config(db, mv_id, payload)
    return ApiResponse(success=True, data=updated, message="MV refresh config updated")


@router.delete("/{mv_id}", response_model=ApiResponse[None])
def delete_mv_refresh_config(mv_id: int, db: Session = Depends(get_session)):
    ok = mv_refresh_service.delete_mv_refresh_config(db, mv_id)
    if not ok:
        return ApiResponse(
            success=False, data=None, message="MV refresh config not found"
        )
    return ApiResponse(success=True, data=None, message="MV refresh config deleted")
