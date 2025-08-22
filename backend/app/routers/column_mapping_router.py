from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Path, Body
from sqlmodel import Session

from app.db.database import get_session
from app.schemas.column_mapping import (
    ColumnMappingRead,
    ColumnMappingCreate,
    ColumnMappingUpdate,
)
from app.services import column_mapping_service
from app.types import ApiResponse

router = APIRouter(prefix="/mappings", tags=["Column Mapping"])


@router.get("", response_model=ApiResponse[List[ColumnMappingRead]])
def list_mappings(
    client_id: Optional[int] = Query(None, description="Filter by client_id"),
    db: Session = Depends(get_session),
):
    data = column_mapping_service.get_all(db, client_id=client_id)
    return ApiResponse(success=True, data=data)


@router.get("/{mapping_id}", response_model=ApiResponse[ColumnMappingRead])
def get_mapping(
    mapping_id: int = Path(..., description="Mapping ID"),
    db: Session = Depends(get_session),
):
    data = column_mapping_service.get_by_id(db, mapping_id)
    return ApiResponse(success=True, data=data)


@router.post("", response_model=ApiResponse[ColumnMappingRead])
def create_mapping(payload: ColumnMappingCreate, db: Session = Depends(get_session)):
    created = column_mapping_service.create(db, payload)
    return ApiResponse(success=True, data=created, message="Mapping created")


@router.post("/batch-save", response_model=ApiResponse[List[ColumnMappingRead]])
def batch_save(
    payloads: List[ColumnMappingCreate] = Body(
        ..., description="Array of mappings to create"
    ),
    db: Session = Depends(get_session),
):
    created = column_mapping_service.batch_add(db, payloads)
    return ApiResponse(
        success=True, data=created, message=f"{len(created)} mappings created"
    )


@router.put("/{mapping_id}", response_model=ApiResponse[ColumnMappingRead])
def update_mapping(
    mapping_id: int, payload: ColumnMappingUpdate, db: Session = Depends(get_session)
):
    updated = column_mapping_service.update(db, mapping_id, payload)
    return ApiResponse(success=True, data=updated, message="Mapping updated")


@router.delete("/{mapping_id}", response_model=ApiResponse[None])
def delete_mapping(mapping_id: int, db: Session = Depends(get_session)):
    column_mapping_service.delete(db, mapping_id)
    return ApiResponse(success=True, data=None, message="Mapping deleted")
