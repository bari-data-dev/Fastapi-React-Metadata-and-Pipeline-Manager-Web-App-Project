from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class OdistsColumn(BaseModel):
    name: str
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
