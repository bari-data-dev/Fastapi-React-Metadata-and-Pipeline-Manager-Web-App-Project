# backend/app/models/client_config.py
import os
from typing import Optional, ClassVar, Dict
from sqlmodel import SQLModel, Field
from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB

SCHEMA = os.getenv("DB_SCHEMA", "tools")


class ClientConfig(SQLModel, table=True):
    __tablename__: ClassVar[str] = "client_config"
    __table_args__: ClassVar[Dict] = {"schema": SCHEMA}

    config_id: Optional[int] = Field(default=None, primary_key=True)
    client_id: int = Field(
        foreign_key=f"{SCHEMA}.client_reference.client_id", index=True
    )
    source_type: str
    target_schema: str
    target_table: str
    # gunakan JSONB untuk menyimpan dict langsung
    source_config: Optional[dict] = Field(default=None, sa_column=Column(JSONB))
    is_active: Optional[bool] = True
    # config_version: Optional[str] = None
    logical_source_file: Optional[str] = None
