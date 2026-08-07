from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.core.auth_dependencies import get_current_user
from app.db.database import get_mysql_pipeline_session, get_session
from app.models.app_user import AppUser
from app.schemas.odists_parsing import (
    OdistsBatchUpdateRequest,
    OdistsBatchUpdateResult,
    OdistsPage,
    OdistsUpdateRequest,
)
from app.services import odists_parsing_service, parsing_baseline_service
from app.types import ApiResponse


router = APIRouter(prefix="/odists-parsing", tags=["ODIST Parsing"])


@router.get("", response_model=ApiResponse[OdistsPage])
def get_odists_page(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=200),
    columns: str | None = None,
    filters: str | None = None,
    sort_by: str = "id",
    sort_dir: str = Query("asc", regex="^(asc|desc)$"),
    mysql_db: Session = Depends(get_mysql_pipeline_session),
    _: AppUser = Depends(get_current_user),
):
    data = odists_parsing_service.get_page(
        db=mysql_db,
        page=page,
        page_size=page_size,
        columns_csv=columns,
        filters_json=filters,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )
    return ApiResponse(success=True, data=OdistsPage(**data))


@router.get("/values/{field}", response_model=ApiResponse[list[dict]])
def get_distinct_values(
    field: str,
    search: str | None = None,
    filters: str | None = None,
    limit: int = Query(100, ge=1, le=200),
    mysql_db: Session = Depends(get_mysql_pipeline_session),
    _: AppUser = Depends(get_current_user),
):
    values = odists_parsing_service.get_distinct_values(
        db=mysql_db,
        field=field,
        search=search,
        filters_json=filters,
        limit=limit,
    )
    return ApiResponse(success=True, data=values)


@router.put("/batch", response_model=ApiResponse[OdistsBatchUpdateResult])
def update_odists_batch(
    payload: OdistsBatchUpdateRequest,
    mysql_db: Session = Depends(get_mysql_pipeline_session),
    audit_db: Session = Depends(get_session),
    current_user: AppUser = Depends(get_current_user),
):
    parsing_baseline_service.ensure_baselines_before_update(
        mysql_db=mysql_db,
        audit_db=audit_db,
        odist_ids=[item.id for item in payload.items],
    )
    result = odists_parsing_service.update_rows(
        mysql_db=mysql_db,
        audit_db=audit_db,
        items=[item.dict() for item in payload.items],
        current_user=current_user,
    )
    return ApiResponse(
        success=True,
        data=OdistsBatchUpdateResult(**result),
        message=f"{result['updated_count']} row ODIST berhasil diperbarui",
    )


@router.put("/{odist_id}", response_model=ApiResponse[dict])
def update_odist(
    odist_id: int,
    payload: OdistsUpdateRequest,
    mysql_db: Session = Depends(get_mysql_pipeline_session),
    audit_db: Session = Depends(get_session),
    current_user: AppUser = Depends(get_current_user),
):
    parsing_baseline_service.ensure_baselines_before_update(
        mysql_db=mysql_db,
        audit_db=audit_db,
        odist_ids=[odist_id],
    )
    updated = odists_parsing_service.update_row(
        mysql_db=mysql_db,
        audit_db=audit_db,
        odist_id=odist_id,
        values=payload.values,
        current_user=current_user,
    )
    return ApiResponse(
        success=True,
        data=updated,
        message="Data ODIST berhasil diperbarui",
    )
