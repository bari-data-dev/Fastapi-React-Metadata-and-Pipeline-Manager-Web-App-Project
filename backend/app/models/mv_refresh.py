# backend/app/models/mv_refresh.py
import os
from typing import Optional, ClassVar, Dict
from datetime import datetime
from sqlmodel import SQLModel, Field

# IMPORTANT: use f-string to include actual schema value
SCHEMA = os.getenv("DB_SCHEMA", "tools")


class MvRefreshConfig(SQLModel, table=True):
    __tablename__: ClassVar[str] = "mv_refresh_config"
    __table_args__: ClassVar[Dict] = {"schema": SCHEMA}

    mv_id: Optional[int] = Field(default=None, primary_key=True)
    # include schema value in foreign_key string (f-string). Using "{SCHEMA}" literal causes NoReferencedTableError.
    client_id: int = Field(
        foreign_key=f"{SCHEMA}.client_reference.client_id", index=True
    )
    mv_proc_name: str = Field(index=True)
    is_active: bool = Field(default=True, index=True)
    refresh_mode: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None
