# backend/app/routers/required_column_router.py
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Path
from sqlmodel import Session

from app.db.database import get_session
from app.schemas.required_columns import (
    RequiredColumnCreate,
    RequiredColumnRead,
    RequiredColumnUpdate,
)
from app.services import required_columns_service
from app.types import ApiResponse

router = APIRouter(prefix="/required-columns", tags=["Required Columns"])


@router.get("", response_model=ApiResponse[List[RequiredColumnRead]])
def list_required_columns(
    client_id: Optional[int] = Query(None, description="Filter by client_id"),
    db: Session = Depends(get_session),
):
    data = required_columns_service.get_all(db, client_id=client_id)
    return ApiResponse(success=True, data=data)


@router.get("/{required_id}", response_model=ApiResponse[RequiredColumnRead])
def get_required_column(
    required_id: int = Path(..., description="Required column id"),
    db: Session = Depends(get_session),
):
    data = required_columns_service.get_by_id(db, required_id)
    return ApiResponse(success=True, data=data)


@router.post("", response_model=ApiResponse[RequiredColumnRead])
def create_required_column(
    payload: RequiredColumnCreate, db: Session = Depends(get_session)
):
    created = required_columns_service.create(db, payload)
    return ApiResponse(success=True, data=created, message="Required column created")


@router.post("/batch-add", response_model=ApiResponse[List[RequiredColumnRead]])
def batch_add_required_columns(
    payloads: List[RequiredColumnCreate], db: Session = Depends(get_session)
):
    created = required_columns_service.batch_add(db, payloads)
    return ApiResponse(
        success=True, data=created, message=f"{len(created)} required columns created"
    )


@router.put("/{required_id}", response_model=ApiResponse[RequiredColumnRead])
def update_required_column(
    required_id: int, payload: RequiredColumnUpdate, db: Session = Depends(get_session)
):
    updated = required_columns_service.update(db, required_id, payload)
    return ApiResponse(success=True, data=updated, message="Required column updated")


@router.delete("/{required_id}", response_model=ApiResponse[None])
def delete_required_column(required_id: int, db: Session = Depends(get_session)):
    required_columns_service.delete(db, required_id)
    return ApiResponse(success=True, data=None, message="Required column deleted")
