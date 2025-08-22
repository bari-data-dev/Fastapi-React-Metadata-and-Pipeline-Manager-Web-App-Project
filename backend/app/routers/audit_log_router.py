from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.db.database import get_session
from app.schemas.audit_log import (
    FileAuditLogRead,
    MappingValidationLogRead,
    RowValidationLogRead,
    LoadErrorLogRead,
    TransformationLogRead,
    JobExecutionLogRead,
    IntegrationLogRead,
    MvRefreshLogRead,
)
from app.services import audit_log_service
from app.types import ApiResponse


router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


@router.get("/files", response_model=ApiResponse[List[FileAuditLogRead]])
def list_file_audit_logs(
    client_id: Optional[int] = Query(None),
    db: Session = Depends(get_session),
):
    data = audit_log_service.get_all_file_audit_logs(db, client_id)
    return ApiResponse(success=True, data=data)


@router.get("/mapping", response_model=ApiResponse[List[MappingValidationLogRead]])
def list_mapping_validation_logs(
    client_id: Optional[int] = Query(None),
    db: Session = Depends(get_session),
):
    data = audit_log_service.get_all_mapping_validation_logs(db, client_id)
    return ApiResponse(success=True, data=data)


@router.get("/rows", response_model=ApiResponse[List[RowValidationLogRead]])
def list_row_validation_logs(
    client_id: Optional[int] = Query(None),
    db: Session = Depends(get_session),
):
    data = audit_log_service.get_all_row_validation_logs(db, client_id)
    return ApiResponse(success=True, data=data)


@router.get("/load-errors", response_model=ApiResponse[List[LoadErrorLogRead]])
def list_load_error_logs(
    client_id: Optional[int] = Query(None),
    db: Session = Depends(get_session),
):
    data = audit_log_service.get_all_load_error_logs(db, client_id)
    return ApiResponse(success=True, data=data)


@router.get("/transformations", response_model=ApiResponse[List[TransformationLogRead]])
def list_transformation_logs(
    client_id: Optional[int] = Query(None),
    db: Session = Depends(get_session),
):
    data = audit_log_service.get_all_transformation_logs(db, client_id)
    return ApiResponse(success=True, data=data)


@router.get("/jobs", response_model=ApiResponse[List[JobExecutionLogRead]])
def list_job_execution_logs(
    client_id: Optional[int] = Query(None),
    db: Session = Depends(get_session),
):
    data = audit_log_service.get_all_job_execution_logs(db, client_id)
    return ApiResponse(success=True, data=data)


@router.get("/integrations", response_model=ApiResponse[List[IntegrationLogRead]])
def list_integration_logs(
    client_id: Optional[int] = Query(None),
    db: Session = Depends(get_session),
):
    data = audit_log_service.get_all_integration_logs(db, client_id)
    return ApiResponse(success=True, data=data)


@router.get("/mv-refresh", response_model=ApiResponse[List[MvRefreshLogRead]])
def list_mv_refresh_logs(
    client_id: Optional[int] = Query(None),
    db: Session = Depends(get_session),
):
    data = audit_log_service.get_all_mv_refresh_logs(db, client_id)
    return ApiResponse(success=True, data=data)
