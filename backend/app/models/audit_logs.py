import os
from sqlmodel import SQLModel, Field
from typing import Optional, ClassVar, Dict
from datetime import datetime

SCHEMA = os.getenv("DB_SCHEMA", "tools")


class FileAuditLog(SQLModel, table=True):
    __tablename__: ClassVar[str] = "file_audit_log"
    __table_args__: ClassVar[Dict] = {"schema": SCHEMA}

    file_audit_id: Optional[int] = Field(default=None, primary_key=True)
    client_id: int = Field(
        foreign_key=f"{SCHEMA}.client_reference.client_id", index=True, nullable=False
    )
    convert_status: Optional[str] = Field(default=None, max_length=20)
    mapping_validation_status: Optional[str] = Field(default=None, max_length=20)
    row_validation_status: Optional[str] = Field(default=None, max_length=20)
    load_status: Optional[str] = Field(default=None, max_length=20)
    config_validation_status: Optional[str] = Field(default=None, max_length=20)
    total_rows: Optional[int] = None
    processed_by: Optional[str] = Field(default=None, max_length=100)
    logical_source_file: Optional[str] = Field(default=None, max_length=100)
    physical_file_name: Optional[str] = Field(default=None, max_length=200)
    batch_id: Optional[str] = Field(default=None, max_length=30)
    file_received_time: Optional[datetime] = None
    source_type: Optional[str] = Field(default=None, max_length=20)
    source_system: Optional[str] = Field(default=None, max_length=20)


class MappingValidationLog(SQLModel, table=True):
    __tablename__: ClassVar[str] = "mapping_validation_log"
    __table_args__: ClassVar[Dict] = {"schema": SCHEMA}

    mapping_id: int = Field(primary_key=True)
    client_id: int = Field(
        foreign_key=f"{SCHEMA}.client_reference.client_id", index=True
    )
    missing_columns: Optional[str] = None
    extra_columns: Optional[str] = None
    expected_columns: Optional[str] = None
    received_columns: Optional[str] = None
    file_name: Optional[str] = None
    batch_id: Optional[str] = None
    timestamp: Optional[datetime] = None


class RowValidationLog(SQLModel, table=True):
    __tablename__: ClassVar[str] = "row_validation_log"
    __table_args__: ClassVar[Dict] = {"schema": SCHEMA}

    error_id: int = Field(primary_key=True)
    client_id: int = Field(
        foreign_key=f"{SCHEMA}.client_reference.client_id", index=True
    )
    file_name: Optional[str] = None
    column_name: Optional[str] = None
    error_type: Optional[str] = None
    error_detail: Optional[str] = None
    batch_id: Optional[str] = None
    timestamp: Optional[datetime] = None


class LoadErrorLog(SQLModel, table=True):
    __tablename__: ClassVar[str] = "load_error_log"
    __table_args__: ClassVar[Dict] = {"schema": SCHEMA}

    error_id: int = Field(primary_key=True)
    client_id: int = Field(
        foreign_key=f"{SCHEMA}.client_reference.client_id", index=True
    )
    error_detail: Optional[str] = None
    stage: Optional[str] = None
    file_name: Optional[str] = None
    batch_id: Optional[str] = None
    timestamp: Optional[datetime] = None


class TransformationLog(SQLModel, table=True):
    __tablename__: ClassVar[str] = "transformation_log"
    __table_args__: ClassVar[Dict] = {"schema": SCHEMA}

    transform_log_id: int = Field(primary_key=True)
    client_id: int = Field(
        foreign_key=f"{SCHEMA}.client_reference.client_id", index=True
    )
    status: Optional[str] = None
    record_count: Optional[int] = None
    source_table: Optional[str] = None
    target_table: Optional[str] = None
    batch_id: Optional[str] = None
    message: Optional[str] = None
    timestamp: Optional[datetime] = None


class JobExecutionLog(SQLModel, table=True):
    __tablename__: ClassVar[str] = "job_execution_log"
    __table_args__: ClassVar[Dict] = {"schema": SCHEMA}

    job_id: int = Field(primary_key=True)
    client_id: int = Field(
        foreign_key=f"{SCHEMA}.client_reference.client_id", index=True
    )
    job_name: Optional[str] = None
    status: Optional[str] = None
    error_message: Optional[str] = None
    file_name: Optional[str] = None
    batch_id: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class IntegrationLog(SQLModel, table=True):
    __tablename__: ClassVar[str] = "integration_log"
    __table_args__: ClassVar[Dict] = {"schema": SCHEMA}

    integration_log_id: int = Field(primary_key=True)
    client_id: int = Field(
        foreign_key=f"{SCHEMA}.client_reference.client_id", index=True
    )
    status: Optional[str] = None
    record_count: Optional[int] = None
    proc_name: str
    table_type: Optional[str] = None
    batch_id: Optional[str] = None
    message: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class MvRefreshLog(SQLModel, table=True):
    __tablename__: ClassVar[str] = "mv_refresh_log"
    __table_args__: ClassVar[Dict] = {"schema": SCHEMA}

    mv_log_id: int = Field(primary_key=True)
    client_id: int = Field(
        foreign_key=f"{SCHEMA}.client_reference.client_id", index=True
    )
    status: Optional[str] = None
    proc_mv_name: str
    batch_id: Optional[str] = None
    message: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
