# backend/app/routers/client_config_router.py
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.db.database import get_session
from app.schemas.client_config import (
    ClientConfigRead,
    BatchConfigSaveRequest,
    ClientConfigUpdate,
)
from app.services import client_config_service
from app.types import ApiResponse

router = APIRouter(prefix="/configs", tags=["Client Config"])


@router.get("", response_model=ApiResponse[List[ClientConfigRead]])
def list_configs(
    client_id: Optional[int] = Query(None, description="Filter by client_id"),
    db: Session = Depends(get_session),
):
    data = client_config_service.get_all(db, client_id=client_id)
    return ApiResponse(success=True, data=data)


@router.post("/batch-save", response_model=ApiResponse[List[ClientConfigRead]])
def batch_save(request: BatchConfigSaveRequest, db: Session = Depends(get_session)):
    created = client_config_service.batch_save(db, request)
    return ApiResponse(
        success=True, data=created, message="Configurations saved successfully"
    )


@router.put("/{config_id}", response_model=ApiResponse[ClientConfigRead])
def update_config(
    config_id: int, payload: ClientConfigUpdate, db: Session = Depends(get_session)
):
    updated = client_config_service.update(db, config_id, payload)
    return ApiResponse(
        success=True, data=updated, message="Configuration updated successfully"
    )


@router.delete("/{config_id}", response_model=ApiResponse[None])
def delete_config(config_id: int, db: Session = Depends(get_session)):
    client_config_service.delete(db, config_id)
    return ApiResponse(
        success=True, data=None, message="Configuration deleted successfully"
    )
