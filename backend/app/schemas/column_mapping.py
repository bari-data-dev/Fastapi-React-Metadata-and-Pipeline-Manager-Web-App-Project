from typing import Optional, List
from pydantic import BaseModel


class ColumnMappingBase(BaseModel):
    client_id: int
    source_column: str
    target_column: str
    logical_source_file: Optional[str] = None


class ColumnMappingCreate(ColumnMappingBase):
    """Payload for creating a single mapping"""

    pass


class ColumnMappingRead(ColumnMappingBase):
    mapping_id: int


class ColumnMappingUpdate(BaseModel):
    # Partial update: all fields optional
    client_id: Optional[int] = None
    source_column: Optional[str] = None
    target_column: Optional[str] = None
    logical_source_file: Optional[str] = None


# Optional wrapper for batch endpoint (if you prefer a wrapped object)
# But we'll accept plain List[ColumnMappingCreate] in router for simplicity.
class BatchMappingSaveRequest(BaseModel):
    mappings: List[ColumnMappingCreate]
