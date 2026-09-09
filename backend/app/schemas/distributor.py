from typing import Any, Dict, List

from pydantic import BaseModel, Field, validator


class DistributorColumn(BaseModel):
    name: str
    label: str
    data_type: str
    is_nullable: bool
    max_length: int | None = None
    editable: bool


class DistributorRecord(BaseModel):
    iddistributor: int
    Kode_Dist: str | None = None
    Kode_Dist_Grup: str | None = None
    Nama_Dist: str | None = None
    Nama_Dist_Grup: str | None = None
    Tgl_Gabung: str | None = None
    Tgl_Data_Pertama: str | None = None
    status: str | None = None


class DistributorPage(BaseModel):
    items: List[DistributorRecord]
    total: int
    page: int
    page_size: int
    total_pages: int
    columns: List[DistributorColumn]


class DistributorCreate(BaseModel):
    Kode_Dist: str = Field(..., min_length=1)
    Kode_Dist_Grup: str = Field(..., min_length=1)
    Nama_Dist: str = Field(..., min_length=1)
    Nama_Dist_Grup: str = Field(..., min_length=1)
    Tgl_Gabung: str = Field(..., min_length=1)
    Tgl_Data_Pertama: str = Field(..., min_length=1)
    status: str = Field(..., min_length=1)

    @validator(
        "Kode_Dist",
        "Kode_Dist_Grup",
        "Nama_Dist",
        "Nama_Dist_Grup",
        "Tgl_Gabung",
        "Tgl_Data_Pertama",
        "status",
    )
    def required_text_must_not_be_blank(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Field wajib diisi")
        return normalized

    @validator("status")
    def status_must_be_binary(cls, value: str) -> str:
        if value not in {"0", "1"}:
            raise ValueError("STATUS AKTIF harus 0 atau 1")
        return value


class DistributorUpdateRequest(BaseModel):
    values: Dict[str, Any]


class DistributorBatchUpdateItem(BaseModel):
    id: int
    values: Dict[str, Any]


class DistributorBatchUpdateRequest(BaseModel):
    items: List[DistributorBatchUpdateItem]


class DistributorBatchUpdateResult(BaseModel):
    updated_count: int
    updated_ids: List[int]


class DistributorDeleteResult(BaseModel):
    deleted_id: int


class DistributorSaveRequest(BaseModel):
    creates: List[DistributorCreate] = []
    updates: List[DistributorBatchUpdateItem] = []
    deletes: List[int] = []


class DistributorSaveResult(BaseModel):
    created_count: int
    created_ids: List[int]
    updated_count: int
    updated_ids: List[int]
    deleted_count: int
    deleted_ids: List[int]
