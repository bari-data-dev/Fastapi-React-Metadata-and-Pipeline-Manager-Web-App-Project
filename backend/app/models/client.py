# backend/app/models/client.py
import os
from typing import Optional, ClassVar, Dict
from sqlmodel import SQLModel, Field

SCHEMA = os.getenv("DB_SCHEMA", "tools")


class ClientReference(SQLModel, table=True):
    __tablename__: ClassVar[str] = "client_reference"
    __table_args__: ClassVar[Dict] = {"schema": SCHEMA}

    client_id: Optional[int] = Field(default=None, primary_key=True)
    client_schema: str = Field(index=True)
    client_name: str
    last_batch_id: Optional[str] = None
