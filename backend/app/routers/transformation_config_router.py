# backend/app/routers/transformation_config_router.py
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Path
from sqlmodel import Session

from app.db.database import get_session
from app.schemas.transformation_config import (
    TransformationConfigCreate,
    TransformationConfigRead,
    TransformationConfigUpdate,
)
from app.services import transformation_config_service
from app.types import ApiResponse

router = APIRouter(prefix="/transformation-configs", tags=["Transformation Configs"])


@router.get("", response_model=ApiResponse[List[TransformationConfigRead]])
def list_transformation_configs(
    client_id: Optional[int] = Query(None, description="Filter by client_id"),
    db: Session = Depends(get_session),
):
    data = transformation_config_service.get_all(db, client_id=client_id)
    return ApiResponse(success=True, data=data)


@router.get("/{transform_id}", response_model=ApiResponse[TransformationConfigRead])
def get_transformation_config(
    transform_id: int = Path(..., description="Transformation config id"),
    db: Session = Depends(get_session),
):
    data = transformation_config_service.get_by_id(db, transform_id)
    return ApiResponse(success=True, data=data)


@router.post("", response_model=ApiResponse[TransformationConfigRead])
def create_transformation_config(
    payload: TransformationConfigCreate, db: Session = Depends(get_session)
):
    created = transformation_config_service.create(db, payload)
    return ApiResponse(
        success=True, data=created, message="Transformation config created"
    )


@router.put("/{transform_id}", response_model=ApiResponse[TransformationConfigRead])
def update_transformation_config(
    transform_id: int,
    payload: TransformationConfigUpdate,
    db: Session = Depends(get_session),
):
    updated = transformation_config_service.update(db, transform_id, payload)
    return ApiResponse(
        success=True, data=updated, message="Transformation config updated"
    )


@router.delete("/{transform_id}", response_model=ApiResponse[None])
def delete_transformation_config(transform_id: int, db: Session = Depends(get_session)):
    transformation_config_service.delete(db, transform_id)
    return ApiResponse(success=True, data=None, message="Transformation config deleted")


@router.post("/batch-add", response_model=ApiResponse[List[TransformationConfigRead]])
def batch_add_transformations(
    payloads: List[TransformationConfigCreate], db: Session = Depends(get_session)
):
    created = transformation_config_service.batch_add(db, payloads)
    return ApiResponse(success=True, data=created, message=f"{len(created)} created")
