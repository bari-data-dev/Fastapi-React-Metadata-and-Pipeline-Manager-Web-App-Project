from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ArtbstColumn(BaseModel):
    name: str
    label: str
    data_type: str
    is_nullable: bool
    max_length: Optional[int] = None
    editable: bool = True


class ArtbstRecord(BaseModel):
    id: int
    artcode: Optional[str] = None
    oms30_0: Optional[str] = None
    u_konversi: Optional[float] = None
    verkp_verp: Optional[float] = None
    dwh_created_by: Optional[str] = None
    dwh_updated_by: Optional[str] = None
    dwh_created_at: datetime
    dwh_updated_at: Optional[datetime] = None


class ArtbstPage(BaseModel):
    items: List[ArtbstRecord]
    total: int
    page: int
    page_size: int
    total_pages: int
    columns: List[ArtbstColumn]


class ArtbstCreate(BaseModel):
    artcode: Optional[str] = Field(None, max_length=20)
    oms30_0: Optional[str] = Field(None, max_length=100)
    u_konversi: Optional[float] = None
    verkp_verp: Optional[float] = None


class ArtbstUpdateRequest(BaseModel):
    values: Dict[str, Any]


class ArtbstBatchUpdateItem(BaseModel):
    id: int
    values: Dict[str, Any]


class ArtbstBatchUpdateRequest(BaseModel):
    items: List[ArtbstBatchUpdateItem]


class ArtbstBatchUpdateResult(BaseModel):
    updated_count: int
    updated_ids: List[int]


class ArtbstSaveRequest(BaseModel):
    creates: List[ArtbstCreate] = Field(default_factory=list)
    updates: List[ArtbstBatchUpdateItem] = Field(default_factory=list)
    deletes: List[int] = Field(default_factory=list)


class ArtbstSaveResult(BaseModel):
    created_count: int
    created_ids: List[int]
    updated_count: int
    updated_ids: List[int]
    deleted_count: int
    deleted_ids: List[int]


class ArtbstDeleteResult(BaseModel):
    deleted_id: int
