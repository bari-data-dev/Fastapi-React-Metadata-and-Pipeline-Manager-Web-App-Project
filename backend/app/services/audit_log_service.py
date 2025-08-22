from typing import List, Optional, cast
from sqlmodel import Session, select
from app.models.audit_logs import (
    FileAuditLog,
    MappingValidationLog,
    RowValidationLog,
    LoadErrorLog,
    TransformationLog,
    JobExecutionLog,
    IntegrationLog,
    MvRefreshLog,
)


def get_all_file_audit_logs(
    db: Session, client_id: Optional[int] = None
) -> List[FileAuditLog]:
    stmt = select(FileAuditLog)
    if client_id is not None:
        stmt = stmt.where(FileAuditLog.client_id == client_id)
    return cast(List[FileAuditLog], db.exec(stmt).all())


def get_all_mapping_validation_logs(
    db: Session, client_id: Optional[int] = None
) -> List[MappingValidationLog]:
    stmt = select(MappingValidationLog)
    if client_id is not None:
        stmt = stmt.where(MappingValidationLog.client_id == client_id)
    return cast(List[MappingValidationLog], db.exec(stmt).all())


def get_all_row_validation_logs(
    db: Session, client_id: Optional[int] = None
) -> List[RowValidationLog]:
    stmt = select(RowValidationLog)
    if client_id is not None:
        stmt = stmt.where(RowValidationLog.client_id == client_id)
    return cast(List[RowValidationLog], db.exec(stmt).all())


def get_all_load_error_logs(
    db: Session, client_id: Optional[int] = None
) -> List[LoadErrorLog]:
    stmt = select(LoadErrorLog)
    if client_id is not None:
        stmt = stmt.where(LoadErrorLog.client_id == client_id)
    return cast(List[LoadErrorLog], db.exec(stmt).all())


def get_all_transformation_logs(
    db: Session, client_id: Optional[int] = None
) -> List[TransformationLog]:
    stmt = select(TransformationLog)
    if client_id is not None:
        stmt = stmt.where(TransformationLog.client_id == client_id)
    return cast(List[TransformationLog], db.exec(stmt).all())


def get_all_job_execution_logs(
    db: Session, client_id: Optional[int] = None
) -> List[JobExecutionLog]:
    stmt = select(JobExecutionLog)
    if client_id is not None:
        stmt = stmt.where(JobExecutionLog.client_id == client_id)
    return cast(List[JobExecutionLog], db.exec(stmt).all())


def get_all_integration_logs(
    db: Session, client_id: Optional[int] = None
) -> List[IntegrationLog]:
    stmt = select(IntegrationLog)
    if client_id is not None:
        stmt = stmt.where(IntegrationLog.client_id == client_id)
    return cast(List[IntegrationLog], db.exec(stmt).all())


def get_all_mv_refresh_logs(
    db: Session, client_id: Optional[int] = None
) -> List[MvRefreshLog]:
    stmt = select(MvRefreshLog)
    if client_id is not None:
        stmt = stmt.where(MvRefreshLog.client_id == client_id)
    return cast(List[MvRefreshLog], db.exec(stmt).all())
