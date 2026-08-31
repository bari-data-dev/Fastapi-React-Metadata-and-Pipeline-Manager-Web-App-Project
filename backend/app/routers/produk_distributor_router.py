import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth_dependencies import get_current_user
from app.db.crm_database import get_crm_connection
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


def _handle_crm_error(exc: Exception) -> None:
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

    logger.exception("Produk Distributor CRM operation failed")
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Operasi database CRM gagal",
    ) from exc


@router.get("", response_model=ApiResponse[ProdukDistributorPage])
def get_produk_distributor_page(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=200),
    filters: str | None = None,
    sort_by: str = "id",
    sort_dir: str = Query("desc", regex="^(asc|desc)$"),
    crm_connection: Any = Depends(get_crm_connection),
    _: AppUser = Depends(get_current_user),
):
    try:
        data = produk_distributor_service.get_page(
            connection=crm_connection,
            page=page,
            page_size=page_size,
            filters_json=filters,
            sort_by=sort_by,
            sort_dir=sort_dir,
        )
        return ApiResponse(success=True, data=ProdukDistributorPage(**data))
    except Exception as exc:
        _handle_crm_error(exc)


@router.get("/values/{field}", response_model=ApiResponse[list[dict]])
def get_produk_distributor_values(
    field: str,
    search: str | None = None,
    filters: str | None = None,
    limit: int = Query(100, ge=1, le=200),
    crm_connection: Any = Depends(get_crm_connection),
    _: AppUser = Depends(get_current_user),
):
    try:
        values = produk_distributor_service.get_distinct_values(
            connection=crm_connection,
            field=field,
            search=search,
            limit=limit,
            filters_json=filters,
        )
        return ApiResponse(success=True, data=values)
    except Exception as exc:
        _handle_crm_error(exc)


@router.post("", response_model=ApiResponse[ProdukDistributorRecord])
def create_produk_distributor(
    payload: ProdukDistributorCreate,
    crm_connection: Any = Depends(get_crm_connection),
    _: AppUser = Depends(get_current_user),
):
    try:
        created = produk_distributor_service.create_record(
            crm_connection,
            payload.dict(),
        )
        return ApiResponse(
            success=True,
            data=ProdukDistributorRecord(**created),
            message="Produk Distributor berhasil ditambahkan",
        )
    except Exception as exc:
        _handle_crm_error(exc)


@router.post("/save", response_model=ApiResponse[ProdukDistributorSaveResult])
def save_produk_distributor_changes(
    payload: ProdukDistributorSaveRequest,
    crm_connection: Any = Depends(get_crm_connection),
    _: AppUser = Depends(get_current_user),
):
    try:
        result = produk_distributor_service.save_changes(
            crm_connection,
            [item.dict() for item in payload.creates],
            [item.dict() for item in payload.updates],
        )
        return ApiResponse(
            success=True,
            data=ProdukDistributorSaveResult(**result),
            message=(
                f"{result['created_count']} row ditambahkan dan "
                f"{result['updated_count']} row diperbarui"
            ),
        )
    except Exception as exc:
        _handle_crm_error(exc)


@router.put("/batch", response_model=ApiResponse[ProdukDistributorBatchUpdateResult])
def update_produk_distributor_batch(
    payload: ProdukDistributorBatchUpdateRequest,
    crm_connection: Any = Depends(get_crm_connection),
    _: AppUser = Depends(get_current_user),
):
    try:
        result = produk_distributor_service.update_batch(
            crm_connection,
            [item.dict() for item in payload.items],
        )
        return ApiResponse(
            success=True,
            data=ProdukDistributorBatchUpdateResult(**result),
            message=f"{result['updated_count']} row berhasil diperbarui",
        )
    except Exception as exc:
        _handle_crm_error(exc)


@router.put("/{record_id}", response_model=ApiResponse[ProdukDistributorRecord])
def update_produk_distributor(
    record_id: int,
    payload: ProdukDistributorUpdateRequest,
    crm_connection: Any = Depends(get_crm_connection),
    _: AppUser = Depends(get_current_user),
):
    try:
        updated = produk_distributor_service.update_record(
            crm_connection,
            record_id,
            payload.values,
        )
        return ApiResponse(
            success=True,
            data=ProdukDistributorRecord(**updated),
            message="Produk Distributor berhasil diperbarui",
        )
    except Exception as exc:
        _handle_crm_error(exc)


@router.delete("/{record_id}", response_model=ApiResponse[ProdukDistributorDeleteResult])
def delete_produk_distributor(
    record_id: int,
    crm_connection: Any = Depends(get_crm_connection),
    _: AppUser = Depends(get_current_user),
):
    try:
        result = produk_distributor_service.delete_record(
            crm_connection,
            record_id,
        )
        return ApiResponse(
            success=True,
            data=ProdukDistributorDeleteResult(**result),
            message="Produk Distributor berhasil dihapus",
        )
    except Exception as exc:
        _handle_crm_error(exc)
