from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Path
from sqlmodel import Session

from app.db.database import get_session
from app.schemas.integration_dependencies import (
    IntegrationDependencyCreate,
    IntegrationDependencyRead,
    IntegrationDependencyUpdate,
)
from app.services import integration_dependencies_service
from app.types import ApiResponse  # jika pakai wrapper ApiResponse; ubah sesuai project

router = APIRouter(
    prefix="/integration-dependencies", tags=["Integration Dependencies"]
)


@router.get("", response_model=ApiResponse[List[IntegrationDependencyRead]])
def list_dependencies(
    client_id: Optional[int] = Query(None, description="Filter by client_id"),
    db: Session = Depends(get_session),
):
    data = integration_dependencies_service.get_all(db, client_id=client_id)
    return ApiResponse(success=True, data=data)


@router.get("/{dependency_id}", response_model=ApiResponse[IntegrationDependencyRead])
def get_dependency(dependency_id: int = Path(...), db: Session = Depends(get_session)):
    data = integration_dependencies_service.get_by_id(db, dependency_id)
    return ApiResponse(success=True, data=data)


@router.post("", response_model=ApiResponse[IntegrationDependencyRead])
def create_dependency(
    payload: IntegrationDependencyCreate, db: Session = Depends(get_session)
):
    obj = integration_dependencies_service.create(db, payload)
    return ApiResponse(success=True, data=obj, message="Integration dependency created")


@router.post("/batch-add", response_model=ApiResponse[List[IntegrationDependencyRead]])
def batch_add_dependencies(
    payloads: List[IntegrationDependencyCreate], db: Session = Depends(get_session)
):
    created = integration_dependencies_service.batch_add(db, payloads)
    return ApiResponse(
        success=True,
        data=created,
        message=f"{len(created)} integration dependencies created",
    )


@router.put("/{dependency_id}", response_model=ApiResponse[IntegrationDependencyRead])
def update_dependency(
    dependency_id: int,
    payload: IntegrationDependencyUpdate,
    db: Session = Depends(get_session),
):
    updated = integration_dependencies_service.update(db, dependency_id, payload)
    return ApiResponse(
        success=True, data=updated, message="Integration dependency updated"
    )


@router.delete("/{dependency_id}", response_model=ApiResponse[None])
def delete_dependency(dependency_id: int, db: Session = Depends(get_session)):
    integration_dependencies_service.delete(db, dependency_id)
    return ApiResponse(
        success=True, data=None, message="Integration dependency deleted"
    )
