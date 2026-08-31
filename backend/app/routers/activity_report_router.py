import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from app.core.auth_dependencies import require_roles
from app.db.database import get_session
from app.models.app_user import AppUser
from app.schemas.activity_report import ActivityReportPage
from app.services import activity_audit_service
from app.types import ApiResponse


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/activity-report", tags=["Activity Report"])
activity_report_access = require_roles("ADMIN", "TEAM", "MANAGER")


@router.get("", response_model=ApiResponse[ActivityReportPage])
def get_activity_report(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    date_from: date | None = None,
    date_to: date | None = None,
    module_key: str | None = None,
    action: str | None = None,
    user_id: int | None = None,
    search: str | None = None,
    db: Session = Depends(get_session),
    _: AppUser = Depends(activity_report_access),
):
    if date_from and date_to and date_from > date_to:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Tanggal mulai tidak boleh lebih besar dari tanggal akhir",
        )

    try:
        data = activity_audit_service.get_activity_report(
            db,
            page=page,
            page_size=page_size,
            date_from=date_from,
            date_to=date_to,
            module_key=module_key,
            action=action,
            user_id=user_id,
            search=search,
        )
        return ApiResponse(success=True, data=ActivityReportPage(**data))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Activity Report database operation failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Gagal mengambil Activity Report",
        ) from exc
