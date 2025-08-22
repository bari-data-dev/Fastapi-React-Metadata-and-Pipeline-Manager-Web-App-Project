# backend/app/routers/integrations_router.py
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Path
from sqlmodel import Session

from app.db.database import get_session
from app.schemas.integration_config import (
    IntegrationConfigCreate,
    IntegrationConfigRead,
    IntegrationConfigUpdate,
)
from app.services import integration_config_service
from app.types import ApiResponse

router = APIRouter(prefix="/integrations", tags=["Integrations"])


@router.get("", response_model=ApiResponse[List[IntegrationConfigRead]])
def list_integrations(
    client_id: Optional[int] = Query(None, description="Filter by client_id"),
    db: Session = Depends(get_session),
):
    data = integration_config_service.get_all(db, client_id=client_id)
    return ApiResponse(success=True, data=data)


@router.get("/{integration_id}", response_model=ApiResponse[IntegrationConfigRead])
def get_integration(
    integration_id: int = Path(..., description="Integration id"),
    db: Session = Depends(get_session),
):
    data = integration_config_service.get_by_id(db, integration_id)
    return ApiResponse(success=True, data=data)


@router.post("", response_model=ApiResponse[IntegrationConfigRead])
def create_integration(
    payload: IntegrationConfigCreate, db: Session = Depends(get_session)
):
    created = integration_config_service.create(db, payload)
    return ApiResponse(success=True, data=created, message="Integration created")


@router.post("/batch-add", response_model=ApiResponse[List[IntegrationConfigRead]])
def batch_add_integrations(
    payloads: List[IntegrationConfigCreate], db: Session = Depends(get_session)
):
    created = integration_config_service.batch_add(db, payloads)
    return ApiResponse(
        success=True, data=created, message=f"{len(created)} integrations created"
    )


@router.put("/{integration_id}", response_model=ApiResponse[IntegrationConfigRead])
def update_integration(
    integration_id: int,
    payload: IntegrationConfigUpdate,
    db: Session = Depends(get_session),
):
    updated = integration_config_service.update(db, integration_id, payload)
    return ApiResponse(success=True, data=updated, message="Integration updated")


@router.delete("/{integration_id}", response_model=ApiResponse[None])
def delete_integration(integration_id: int, db: Session = Depends(get_session)):
    integration_config_service.delete(db, integration_id)
    return ApiResponse(success=True, data=None, message="Integration deleted")
