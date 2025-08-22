# backend/app/schemas/required_columns.py
from typing import Optional
from pydantic import BaseModel


class RequiredColumnBase(BaseModel):
    client_id: int
    column_name: str
    logical_source_file: Optional[str] = None


class RequiredColumnCreate(RequiredColumnBase):
    pass


class RequiredColumnRead(RequiredColumnBase):
    required_id: int


class RequiredColumnUpdate(BaseModel):
    client_id: Optional[int] = None
    column_name: Optional[str] = None
    logical_source_file: Optional[str] = None
