# src/app/models/transformation_config.py
import os
from typing import Optional, ClassVar, Dict
from datetime import datetime
from sqlmodel import SQLModel, Field, Column
from sqlalchemy.sql import func

SCHEMA = os.getenv("DB_SCHEMA", "tools")


class TransformationConfig(SQLModel, table=True):
    __tablename__: ClassVar[str] = "transformation_config"
    __table_args__: ClassVar[Dict] = {"schema": SCHEMA}

    transform_id: Optional[int] = Field(default=None, primary_key=True)
    client_id: int = Field(
        foreign_key=f"{SCHEMA}.client_reference.client_id", index=True
    )
    proc_name: str = Field(index=True)
    is_active: Optional[bool] = Field(default=True, index=True)
    created_at: Optional[datetime] = Field(
        sa_column=Column(
            "created_at",
            nullable=True,
            server_default=func.now(),  # set default in DB
        )
    )
    created_by: Optional[str] = None
