import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from app.core.auth_dependencies import require_roles
from app.db.database import get_session
from app.models.app_user import AppUser
from app.schemas.artbst import (
    ArtbstBatchUpdateRequest,
    ArtbstBatchUpdateResult,
    ArtbstCreate,
    ArtbstDeleteResult,
    ArtbstPage,
    ArtbstRecord,
    ArtbstSaveRequest,
    ArtbstSaveResult,
    ArtbstUpdateRequest,
)
from app.services import artbst_service
from app.types import ApiResponse


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/artbst", tags=["ARTBST"])
artbst_access = require_roles("ADMIN", "TEAM", "MANAGER")


def _handle_db_error(exc: Exception) -> None:
    if isinstance(exc, ValueError):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    if isinstance(exc, LookupError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    logger.exception("ARTBST database operation failed")
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Operasi database ARTBST gagal") from exc


@router.get("", response_model=ApiResponse[ArtbstPage])
def get_artbst_page(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=200),
    filters: str | None = None,
    sort_by: str = "id",
    sort_dir: str = Query("desc", regex="^(asc|desc)$"),
    db: Session = Depends(get_session),
    _: AppUser = Depends(artbst_access),
):
    try:
        data = artbst_service.get_page(db, page, page_size, filters, sort_by, sort_dir)
        return ApiResponse(success=True, data=ArtbstPage(**data))
    except Exception as exc:
        _handle_db_error(exc)


@router.get("/values/{field}", response_model=ApiResponse[list[dict]])
def get_artbst_values(
    field: str,
    search: str | None = None,
    filters: str | None = None,
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_session),
    _: AppUser = Depends(artbst_access),
):
    try:
        values = artbst_service.get_distinct_values(db, field, search, limit, filters)
        return ApiResponse(success=True, data=values)
    except Exception as exc:
        _handle_db_error(exc)


@router.post("", response_model=ApiResponse[ArtbstRecord])
def create_artbst(
    payload: ArtbstCreate,
    db: Session = Depends(get_session),
    current_user: AppUser = Depends(artbst_access),
):
    try:
        created = artbst_service.create_record(db, payload.dict(), current_user)
        return ApiResponse(success=True, data=ArtbstRecord(**created), message="ARTBST berhasil ditambahkan")
    except Exception as exc:
        _handle_db_error(exc)


@router.post("/save", response_model=ApiResponse[ArtbstSaveResult])
def save_artbst_changes(
    payload: ArtbstSaveRequest,
    db: Session = Depends(get_session),
    current_user: AppUser = Depends(artbst_access),
):
    try:
        result = artbst_service.save_changes(
            db,
            [item.dict() for item in payload.creates],
            [item.dict() for item in payload.updates],
            payload.deletes,
            current_user,
        )
        return ApiResponse(success=True, data=ArtbstSaveResult(**result), message=(
            f"{result['created_count']} row ditambahkan, "
            f"{result['updated_count']} row diperbarui, dan "
            f"{result['deleted_count']} row dihapus"
        ))
    except Exception as exc:
        _handle_db_error(exc)


@router.put("/batch", response_model=ApiResponse[ArtbstBatchUpdateResult])
def update_artbst_batch(
    payload: ArtbstBatchUpdateRequest,
    db: Session = Depends(get_session),
    current_user: AppUser = Depends(artbst_access),
):
    try:
        result = artbst_service.update_batch(db, [item.dict() for item in payload.items], current_user)
        return ApiResponse(success=True, data=ArtbstBatchUpdateResult(**result), message=f"{result['updated_count']} row berhasil diperbarui")
    except Exception as exc:
        _handle_db_error(exc)


@router.put("/{record_id}", response_model=ApiResponse[ArtbstRecord])
def update_artbst(
    record_id: int,
    payload: ArtbstUpdateRequest,
    db: Session = Depends(get_session),
    current_user: AppUser = Depends(artbst_access),
):
    try:
        updated = artbst_service.update_record(db, record_id, payload.values, current_user)
        return ApiResponse(success=True, data=ArtbstRecord(**updated), message="ARTBST berhasil diperbarui")
    except Exception as exc:
        _handle_db_error(exc)


@router.delete("/{record_id}", response_model=ApiResponse[ArtbstDeleteResult])
def delete_artbst(
    record_id: int,
    db: Session = Depends(get_session),
    current_user: AppUser = Depends(artbst_access),
):
    try:
        result = artbst_service.delete_record(db, record_id, current_user)
        return ApiResponse(success=True, data=ArtbstDeleteResult(**result), message="ARTBST berhasil dihapus")
    except Exception as exc:
        _handle_db_error(exc)
