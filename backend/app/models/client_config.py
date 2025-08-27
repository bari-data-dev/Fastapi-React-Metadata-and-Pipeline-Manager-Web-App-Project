from typing import Optional, ClassVar, Dict
from sqlmodel import SQLModel, Field, Column
from sqlalchemy.dialects.postgresql import JSONB

SCHEMA = "tools"

class ClientConfig(SQLModel, table=True):
    __tablename__: ClassVar[str] = "client_config"
    __table_args__: ClassVar[Dict] = {"schema": SCHEMA}

    config_id: Optional[int] = Field(default=None, primary_key=True)
    client_id: int = Field(
        foreign_key=f"{SCHEMA}.client_reference.client_id", index=True, nullable=False
    )
    source_type: str = Field(nullable=False, max_length=20)
    target_schema: str = Field(nullable=False, max_length=50)
    target_table: str = Field(nullable=False, max_length=50)
    source_config: Optional[dict] = Field(default=None, sa_column=Column(JSONB))
    is_active: Optional[bool] = Field(default=True)
    logical_source_file: Optional[str] = Field(default=None, max_length=100)
    source_system: str = Field(nullable=False, max_length=20)
