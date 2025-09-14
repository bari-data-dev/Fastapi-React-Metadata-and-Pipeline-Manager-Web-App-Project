# backend/app/models/column_mapping.py
import os
from typing import Optional, ClassVar, Dict
from sqlmodel import SQLModel, Field

SCHEMA = os.getenv("DB_SCHEMA", "tools")


class ColumnMapping(SQLModel, table=True):
    __tablename__: ClassVar[str] = "column_mapping"
    __table_args__: ClassVar[Dict] = {"schema": SCHEMA}

    mapping_id: Optional[int] = Field(default=None, primary_key=True)
    # include schema name in foreign_key
    client_id: int = Field(
        foreign_key=f"{SCHEMA}.client_reference.client_id", index=True
    )
    source_column: str = Field(index=True)
    target_column: str = Field(index=True)
    is_active: Optional[bool] = True
    logical_source_file: Optional[str] = None
    source_type: str = Field(nullable=False, max_length=20)
    source_system: str = Field(nullable=False, max_length=20)
