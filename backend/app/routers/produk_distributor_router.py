import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from app.core.auth_dependencies import require_roles
from app.db.database import get_session
from app.models.app_user import AppUser
from app.schemas.produk_distributor import (
    ProdukDistributorBatchUpdateRequest,
    ProdukDistributorBatchUpdateResult,
    ProdukDistributorCreate,
    ProdukDistributorDeleteResult,
    ProdukDistributorPage,
    ProdukDistributorRecord,
    ProdukDistributorSaveRequest,
    ProdukDistributorSaveResult,
    ProdukDistributorUpdateRequest,
)
from app.services import produk_distributor_service
from app.types import ApiResponse


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/produk-distributor", tags=["Produk Distributor"])
produk_distributor_access = require_roles("ADMIN", "TEAM", "MANAGER")


def _handle_db_error(exc: Exception) -> None:
    if isinstance(exc, ValueError):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    if isinstance(exc, LookupError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    logger.exception("Produk Distributor database operation failed")
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Operasi database Produk Distributor gagal",
    ) from exc


@router.get("", response_model=ApiResponse[ProdukDistributorPage])
def get_produk_distributor_page(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=200),
    filters: str | None = None,
    sort_by: str = "id",
    sort_dir: str = Query("desc", regex="^(asc|desc)$"),
    db: Session = Depends(get_session),
    _: AppUser = Depends(produk_distributor_access),
):
    try:
        data = produk_distributor_service.get_page(
            db=db,
            page=page,
            page_size=page_size,
            filters_json=filters,
            sort_by=sort_by,
            sort_dir=sort_dir,
        )
        return ApiResponse(success=True, data=ProdukDistributorPage(**data))
    except Exception as exc:
        _handle_db_error(exc)


@router.get("/values/{field}", response_model=ApiResponse[list[dict]])
def get_produk_distributor_values(
    field: str,
    search: str | None = None,
    filters: str | None = None,
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_session),
    _: AppUser = Depends(produk_distributor_access),
):
    try:
        values = produk_distributor_service.get_distinct_values(
            db=db,
            field=field,
            search=search,
            limit=limit,
            filters_json=filters,
        )
        return ApiResponse(success=True, data=values)
    except Exception as exc:
        _handle_db_error(exc)


@router.post("", response_model=ApiResponse[ProdukDistributorRecord])
def create_produk_distributor(
    payload: ProdukDistributorCreate,
    db: Session = Depends(get_session),
    current_user: AppUser = Depends(produk_distributor_access),
):
    try:
        created = produk_distributor_service.create_record(
            db,
            payload.dict(),
            current_user,
        )
        return ApiResponse(
            success=True,
            data=ProdukDistributorRecord(**created),
            message="Produk Distributor berhasil ditambahkan",
        )
    except Exception as exc:
        _handle_db_error(exc)


@router.post("/save", response_model=ApiResponse[ProdukDistributorSaveResult])
def save_produk_distributor_changes(
    payload: ProdukDistributorSaveRequest,
    db: Session = Depends(get_session),
    current_user: AppUser = Depends(produk_distributor_access),
):
    try:
        result = produk_distributor_service.save_changes(
            db,
            [item.dict() for item in payload.creates],
            [item.dict() for item in payload.updates],
            payload.deletes,
            current_user,
        )
        return ApiResponse(
            success=True,
            data=ProdukDistributorSaveResult(**result),
            message=(
                f"{result['created_count']} row ditambahkan, "
                f"{result['updated_count']} row diperbarui, dan "
                f"{result['deleted_count']} row dihapus"
            ),
        )
    except Exception as exc:
        _handle_db_error(exc)


@router.put("/batch", response_model=ApiResponse[ProdukDistributorBatchUpdateResult])
def update_produk_distributor_batch(
    payload: ProdukDistributorBatchUpdateRequest,
    db: Session = Depends(get_session),
    current_user: AppUser = Depends(produk_distributor_access),
):
    try:
        result = produk_distributor_service.update_batch(
            db,
            [item.dict() for item in payload.items],
            current_user,
        )
        return ApiResponse(
            success=True,
            data=ProdukDistributorBatchUpdateResult(**result),
            message=f"{result['updated_count']} row berhasil diperbarui",
        )
    except Exception as exc:
        _handle_db_error(exc)


@router.put("/{record_id}", response_model=ApiResponse[ProdukDistributorRecord])
def update_produk_distributor(
    record_id: int,
    payload: ProdukDistributorUpdateRequest,
    db: Session = Depends(get_session),
    current_user: AppUser = Depends(produk_distributor_access),
):
    try:
        updated = produk_distributor_service.update_record(
            db,
            record_id,
            payload.values,
            current_user,
        )
        return ApiResponse(
            success=True,
            data=ProdukDistributorRecord(**updated),
            message="Produk Distributor berhasil diperbarui",
        )
    except Exception as exc:
        _handle_db_error(exc)


@router.delete("/{record_id}", response_model=ApiResponse[ProdukDistributorDeleteResult])
def delete_produk_distributor(
    record_id: int,
    db: Session = Depends(get_session),
    current_user: AppUser = Depends(produk_distributor_access),
):
    try:
        result = produk_distributor_service.delete_record(db, record_id, current_user)
        return ApiResponse(
            success=True,
            data=ProdukDistributorDeleteResult(**result),
            message="Produk Distributor berhasil dihapus",
        )
    except Exception as exc:
        _handle_db_error(exc)
