# backend/app/schemas/column_mapping.py
from typing import Optional, List
from pydantic import BaseModel


class ColumnMappingBase(BaseModel):
    client_id: int
    source_column: str
    target_column: str
    logical_source_file: str            
    is_active: Optional[bool] = True   
    source_system: Optional[str] = None
    source_type: Optional[str] = None


class ColumnMappingCreate(ColumnMappingBase):
    pass


class ColumnMappingRead(ColumnMappingBase):
    mapping_id: int


class ColumnMappingUpdate(BaseModel):
    # Partial update: semua optional
    client_id: Optional[int] = None
    source_column: Optional[str] = None
    target_column: Optional[str] = None
    logical_source_file: Optional[str] = None
    is_active: Optional[bool] = None
    source_system: Optional[str] = None
    source_type: Optional[str] = None


class BatchMappingSaveRequest(BaseModel):
    mappings: List[ColumnMappingCreate]
