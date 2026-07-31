# backend/app/schemas/bronze_mapping_kowil.py
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class BronzeMappingKowilBase(BaseModel):
    kowil_lama_2024: Optional[str] = None
    kowil_baru_feb25: Optional[str] = None
    kowil_baru_sept25: Optional[str] = None

    spv_2: Optional[str] = None
    asm_2: Optional[str] = None
    rsm: Optional[str] = None

    nama_asm: Optional[str] = None
    nama_karyawan: Optional[str] = None
    nama_mso: Optional[str] = None

    source_sheet: Optional[str] = None


class BronzeMappingKowilCreate(BronzeMappingKowilBase):
    pass


class BronzeMappingKowilRead(BronzeMappingKowilBase):
    mapping_id: int
    dwh_loaded_at: Optional[datetime] = None


class BronzeMappingKowilUpdate(BaseModel):
    kowil_lama_2024: Optional[str] = None
    kowil_baru_feb25: Optional[str] = None
    kowil_baru_sept25: Optional[str] = None

    spv_2: Optional[str] = None
    asm_2: Optional[str] = None
    rsm: Optional[str] = None

    nama_asm: Optional[str] = None
    nama_karyawan: Optional[str] = None
    nama_mso: Optional[str] = None

    source_sheet: Optional[str] = None
