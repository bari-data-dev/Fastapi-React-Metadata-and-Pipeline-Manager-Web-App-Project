from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class OdistsColumn(BaseModel):
    name: str
    label: str
    data_type: str
    is_nullable: bool
    ordinal_position: int
    editable: bool


class OdistsPage(BaseModel):
    items: List[Dict[str, Any]]
    total: int
    page: int
    page_size: int
    total_pages: int
    columns: List[OdistsColumn]


class OdistsUpdateRequest(BaseModel):
    values: Dict[str, Optional[Any]] = Field(default_factory=dict)


class OdistsBatchUpdateItem(BaseModel):
    id: int
    values: Dict[str, Optional[Any]] = Field(default_factory=dict)


class OdistsBatchUpdateRequest(BaseModel):
    items: List[OdistsBatchUpdateItem] = Field(..., min_items=1, max_items=200)


class OdistsBatchUpdateResult(BaseModel):
    updated_count: int
    updated_ids: List[int]
