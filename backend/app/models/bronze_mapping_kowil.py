# backend/app/models/bronze_mapping_kowil.py
import os
from datetime import datetime
from typing import Optional, ClassVar, Dict

from sqlmodel import SQLModel, Field
from sqlalchemy import Column, DateTime, text

SCHEMA = os.getenv("DB_SCHEMA_BRONZE_CALL_REPORT", "bronze_call_report")


class BronzeMappingKowil(SQLModel, table=True):
    __tablename__: ClassVar[str] = "crm_mapping_kowil"
    __table_args__: ClassVar[Dict] = {"schema": SCHEMA}

    mapping_id: Optional[int] = Field(default=None, primary_key=True)

    kowil_lama_2024: Optional[str] = Field(default=None, max_length=100)
    kowil_baru_feb25: Optional[str] = Field(default=None, max_length=100)
    kowil_baru_sept25: Optional[str] = Field(default=None, max_length=100)

    spv_2: Optional[str] = Field(default=None, max_length=100)
    asm_2: Optional[str] = Field(default=None, max_length=100)
    rsm: Optional[str] = Field(default=None, max_length=100)

    nama_asm: Optional[str] = Field(default=None, max_length=150)
    nama_karyawan: Optional[str] = Field(default=None, max_length=150)
    nama_mso: Optional[str] = Field(default=None, max_length=150)

    source_sheet: Optional[str] = Field(default=None, max_length=200)

    # DEFAULT sysdatetime() di SQL Server
    dwh_loaded_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime, server_default=text("sysdatetime()")),
    )
