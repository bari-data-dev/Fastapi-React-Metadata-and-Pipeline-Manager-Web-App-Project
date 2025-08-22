# backend/app/models/integrations.py
import os
from typing import Optional, ClassVar, Dict
from datetime import datetime
from sqlmodel import SQLModel, Field

SCHEMA = os.getenv("DB_SCHEMA", "tools")


class IntegrationConfig(SQLModel, table=True):
    __tablename__: ClassVar[str] = "integration_config"
    __table_args__: ClassVar[Dict] = {"schema": SCHEMA}

    integration_id: Optional[int] = Field(default=None, primary_key=True)
    # note: include schema in foreign_key to avoid NoReferencedTableError
    client_id: int = Field(
        foreign_key=f"{SCHEMA}.client_reference.client_id", index=True
    )
    proc_name: str = Field(index=True)
    is_active: bool = Field(default=True, index=True)
    table_type: Optional[str] = None
    run_order: Optional[int] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None
