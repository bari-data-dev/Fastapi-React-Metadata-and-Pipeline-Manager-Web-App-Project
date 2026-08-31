from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ProdukDistributorColumn(BaseModel):
    name: str
    label: str
    data_type: str
    is_nullable: bool
    max_length: Optional[int] = None
    editable: bool = True


class ProdukDistributorRecord(BaseModel):
    id: int
    Kode_Dist: str
    Kode_Produk_Dist: str
    Kode_Produk_GPL: Optional[str] = None
    Konversi_Unit: Optional[int] = None
    Nama_Produk_GPL: Optional[str] = None
    Nama_Produk_Dist: Optional[str] = None
    Produk_Paket: Optional[int] = None
    temp: Optional[str] = None
    dwh_created_by: Optional[str] = None
    dwh_updated_by: Optional[str] = None
    dwh_created_at: Optional[datetime] = None
    dwh_updated_at: Optional[datetime] = None


class ProdukDistributorPage(BaseModel):
    items: List[ProdukDistributorRecord]
    total: int
    page: int
    page_size: int
    total_pages: int
    columns: List[ProdukDistributorColumn]


class ProdukDistributorCreate(BaseModel):
    Kode_Dist: str = Field(..., min_length=1, max_length=15)
    Kode_Produk_Dist: str = Field(..., min_length=1, max_length=80)
    Kode_Produk_GPL: Optional[str] = Field(None, max_length=15)
    Konversi_Unit: Optional[int] = None
    Nama_Produk_GPL: Optional[str] = Field(None, max_length=100)
    Nama_Produk_Dist: Optional[str] = Field(None, max_length=100)
    Produk_Paket: Optional[int] = None
    temp: Optional[str] = Field(None, max_length=50)


class ProdukDistributorUpdateRequest(BaseModel):
    values: Dict[str, Any]


class ProdukDistributorBatchUpdateItem(BaseModel):
    id: int
    values: Dict[str, Any]


class ProdukDistributorBatchUpdateRequest(BaseModel):
    items: List[ProdukDistributorBatchUpdateItem]


class ProdukDistributorBatchUpdateResult(BaseModel):
    updated_count: int
    updated_ids: List[int]


class ProdukDistributorSaveRequest(BaseModel):
    creates: List[ProdukDistributorCreate] = Field(default_factory=list)
    updates: List[ProdukDistributorBatchUpdateItem] = Field(default_factory=list)
    deletes: List[int] = Field(default_factory=list)


class ProdukDistributorSaveResult(BaseModel):
    created_count: int
    created_ids: List[int]
    updated_count: int
    updated_ids: List[int]
    deleted_count: int
    deleted_ids: List[int]


class ProdukDistributorDeleteResult(BaseModel):
    deleted_id: int
