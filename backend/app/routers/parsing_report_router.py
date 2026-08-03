from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.core.auth_dependencies import get_current_user
from app.db.database import get_mysql_pipeline_session, get_session
from app.models.app_user import AppUser
from app.services import parsing_report_service
from app.types import ApiResponse


router = APIRouter(prefix="/parsing-report", tags=["Parsing Report"])


@router.get("/summary", response_model=ApiResponse[dict])
def get_summary(
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    user_id: int | None = None,
    mysql_db: Session = Depends(get_mysql_pipeline_session),
    audit_db: Session = Depends(get_session),
    _: AppUser = Depends(get_current_user),
):
    data = parsing_report_service.get_summary(
        mysql_db=mysql_db,
        audit_db=audit_db,
        date_from=date_from,
        date_to=date_to,
        user_id=user_id,
    )
    return ApiResponse(success=True, data=data)


@router.get("/effective", response_model=ApiResponse[dict])
def get_effective_results(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user_id: int | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    search: str | None = None,
    mysql_db: Session = Depends(get_mysql_pipeline_session),
    audit_db: Session = Depends(get_session),
    _: AppUser = Depends(get_current_user),
):
    data = parsing_report_service.get_effective_results(
        mysql_db=mysql_db,
        audit_db=audit_db,
        page=page,
        page_size=page_size,
        user_id=user_id,
        status_filter=status_filter,
        search=search,
    )
    return ApiResponse(success=True, data=data)


@router.get("/history", response_model=ApiResponse[dict])
def get_activity_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    user_id: int | None = None,
    change_type: str | None = None,
    revert_state: str | None = None,
    search: str | None = None,
    mysql_db: Session = Depends(get_mysql_pipeline_session),
    audit_db: Session = Depends(get_session),
    _: AppUser = Depends(get_current_user),
):
    data = parsing_report_service.get_activity_history(
        mysql_db=mysql_db,
        audit_db=audit_db,
        page=page,
        page_size=page_size,
        date_from=date_from,
        date_to=date_to,
        user_id=user_id,
        change_type=change_type,
        revert_state=revert_state,
        search=search,
    )
    return ApiResponse(success=True, data=data)
