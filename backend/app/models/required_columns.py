# backend/app/models/required_columns.py
import os
from typing import Optional, ClassVar, Dict
from sqlmodel import SQLModel, Field

SCHEMA = os.getenv("DB_SCHEMA", "tools")


class RequiredColumn(SQLModel, table=True):
    __tablename__: ClassVar[str] = "required_columns"
    __table_args__: ClassVar[Dict] = {"schema": SCHEMA}

    required_id: Optional[int] = Field(default=None, primary_key=True)
    # include schema in foreign_key so SQLAlchemy can resolve the referenced table
    client_id: int = Field(
        foreign_key=f"{SCHEMA}.client_reference.client_id", index=True
    )
    column_name: str = Field(index=True)
    logical_source_file: Optional[str] = None
