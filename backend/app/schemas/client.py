# backend/app/schemas/client.py
from typing import Optional
from pydantic import BaseModel


class ClientBase(BaseModel):
    client_schema: str
    client_name: str
    last_batch_id: Optional[str] = None


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    # semua field optional di update (partial)
    client_schema: Optional[str] = None
    client_name: Optional[str] = None
    last_batch_id: Optional[str] = None


class ClientRead(ClientBase):
    client_id: int
