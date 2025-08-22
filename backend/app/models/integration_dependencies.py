# backend/app/models/integration_dependencies.py
import os
from typing import Optional, ClassVar, Dict
from sqlmodel import SQLModel, Field

SCHEMA = os.getenv("DB_SCHEMA", "tools")  # sama seperti file lain


class IntegrationDependency(SQLModel, table=True):
    __tablename__: ClassVar[str] = "integration_dependencies"
    __table_args__: ClassVar[Dict] = {"schema": SCHEMA}

    dependency_id: Optional[int] = Field(default=None, primary_key=True)
    client_id: int = Field(
        foreign_key=f"{SCHEMA}.client_reference.client_id", index=True
    )
    fact_proc_name: str = Field(index=True)
    dim_proc_name: str = Field(index=True)
