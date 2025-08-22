# app/schemas/transformation_config.py
from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class TransformationConfigBase(BaseModel):
    client_id: int
    proc_name: str
    is_active: Optional[bool] = True
    created_by: Optional[str] = None
    logical_source_file: Optional[str] = None  # optional UX field if needed


class TransformationConfigCreate(TransformationConfigBase):
    pass


class TransformationConfigRead(TransformationConfigBase):
    transform_id: int
    created_at: datetime

    class Config:
        orm_mode = True


class TransformationConfigUpdate(BaseModel):
    client_id: Optional[int]
    proc_name: Optional[str]
    is_active: Optional[bool]
    created_by: Optional[str]
    logical_source_file: Optional[str]
