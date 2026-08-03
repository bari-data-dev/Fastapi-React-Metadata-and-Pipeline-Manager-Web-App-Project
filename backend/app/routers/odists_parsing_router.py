from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.core.auth_dependencies import get_current_user
from app.db.database import get_session
from app.models.app_user import AppUser
from app.schemas.odists_parsing import OdistsPage, OdistsUpdateRequest
from app.services import odists_parsing_service
from app.types import ApiResponse


router = APIRouter(prefix="/odists-parsing", tags=["ODIST Parsing"])


@router.get("", response_model=ApiResponse[OdistsPage])
def get_odists_page(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    columns: str | None = None,
    filters: str | None = None,
    sort_by: str = "id",
    sort_dir: str = Query("asc", regex="^(asc|desc)$"),
    db: Session = Depends(get_session),
    _: AppUser = Depends(get_current_user),
):
    data = odists_parsing_service.get_page(
        db=db,
        page=page,
        page_size=page_size,
        columns_csv=columns,
        filters_json=filters,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )
    return ApiResponse(success=True, data=OdistsPage(**data))


@router.put("/{odist_id}", response_model=ApiResponse[dict])
def update_odist(
    odist_id: int,
    payload: OdistsUpdateRequest,
    db: Session = Depends(get_session),
    current_user: AppUser = Depends(get_current_user),
):
    updated = odists_parsing_service.update_row(
        db=db,
        odist_id=odist_id,
        values=payload.values,
        current_user=current_user,
    )
    return ApiResponse(success=True, data=updated, message="Data ODIST berhasil diperbarui")
