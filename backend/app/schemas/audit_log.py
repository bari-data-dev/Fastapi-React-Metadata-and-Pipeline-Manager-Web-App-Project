from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel


class FileAuditLogRead(SQLModel):
    file_audit_id: int
    client_id: int
    convert_status: Optional[str]
    mapping_validation_status: Optional[str]
    row_validation_status: Optional[str]
    load_status: Optional[str]
    total_rows: Optional[int]
    valid_rows: Optional[int]
    invalid_rows: Optional[int]
    processed_by: Optional[str]
    logical_source_file: Optional[str]
    physical_file_name: Optional[str]
    parquet_file_name: Optional[str]
    batch_id: Optional[str]
    file_received_time: Optional[datetime]
    parquet_converted_time: Optional[datetime]


class MappingValidationLogRead(SQLModel):
    mapping_id: int
    client_id: int
    missing_columns: Optional[str]
    extra_columns: Optional[str]
    expected_columns: Optional[str]
    received_columns: Optional[str]
    file_name: Optional[str]
    batch_id: Optional[str]
    timestamp: Optional[datetime]


class RowValidationLogRead(SQLModel):
    error_id: int
    client_id: int
    file_name: Optional[str]
    column_name: Optional[str]
    row_number: Optional[int]
    error_type: Optional[str]
    error_detail: Optional[str]
    batch_id: Optional[str]
    timestamp: Optional[datetime]


class LoadErrorLogRead(SQLModel):
    error_id: int
    client_id: int
    error_detail: Optional[str]
    stage: Optional[str]
    file_name: Optional[str]
    batch_id: Optional[str]
    timestamp: Optional[datetime]


class TransformationLogRead(SQLModel):
    transform_log_id: int
    client_id: int
    status: Optional[str]
    record_count: Optional[int]
    source_table: Optional[str]
    target_table: Optional[str]
    batch_id: Optional[str]
    message: Optional[str]
    timestamp: Optional[datetime]


class JobExecutionLogRead(SQLModel):
    job_id: int
    client_id: int
    job_name: Optional[str]
    status: Optional[str]
    error_message: Optional[str]
    file_name: Optional[str]
    batch_id: Optional[str]
    start_time: Optional[datetime]
    end_time: Optional[datetime]


class IntegrationLogRead(SQLModel):
    integration_log_id: int
    client_id: int
    status: Optional[str]
    record_count: Optional[int]
    proc_name: str
    table_type: Optional[str]
    batch_id: Optional[str]
    message: Optional[str]
    start_time: Optional[datetime]
    end_time: Optional[datetime]


class MvRefreshLogRead(SQLModel):
    mv_log_id: int
    client_id: int
    status: Optional[str]
    proc_mv_name: str
    batch_id: Optional[str]
    message: Optional[str]
    start_time: Optional[datetime]
    end_time: Optional[datetime]
