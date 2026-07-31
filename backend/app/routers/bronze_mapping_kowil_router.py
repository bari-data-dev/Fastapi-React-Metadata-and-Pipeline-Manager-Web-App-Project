# backend/app/routers/bronze_mapping_kowil_router.py
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.db.database import get_session
from app.schemas.bronze_mapping_kowil import (
    BronzeMappingKowilCreate,
    BronzeMappingKowilUpdate,
    BronzeMappingKowilRead,
)
from app.services import bronze_mapping_kowil_service as service
from app.types import ApiResponse

router = APIRouter(prefix="/bronze-mapping-kowil", tags=["Bronze Mapping Kowil"])


@router.get("", response_model=ApiResponse[List[BronzeMappingKowilRead]])
def list_mapping_kowil(
    kowil_lama_2024: Optional[str] = Query(
        None, description="Filter by kowil_lama_2024"
    ),
    kowil_baru_feb25: Optional[str] = Query(
        None, description="Filter by kowil_baru_feb25"
    ),
    kowil_baru_sept25: Optional[str] = Query(
        None, description="Filter by kowil_baru_sept25"
    ),
    spv_2: Optional[str] = Query(None, description="Filter by spv_2"),
    asm_2: Optional[str] = Query(None, description="Filter by asm_2"),
    rsm: Optional[str] = Query(None, description="Filter by rsm"),
    nama_asm: Optional[str] = Query(None, description="Filter by nama_asm"),
    nama_karyawan: Optional[str] = Query(None, description="Filter by nama_karyawan"),
    nama_mso: Optional[str] = Query(None, description="Filter by nama_mso"),
    source_sheet: Optional[str] = Query(None, description="Filter by source_sheet"),
    db: Session = Depends(get_session),
):
    data = service.get_all(
        db,
        kowil_lama_2024=kowil_lama_2024,
        kowil_baru_feb25=kowil_baru_feb25,
        kowil_baru_sept25=kowil_baru_sept25,
        spv_2=spv_2,
        asm_2=asm_2,
        rsm=rsm,
        nama_asm=nama_asm,
        nama_karyawan=nama_karyawan,
        nama_mso=nama_mso,
        source_sheet=source_sheet,
    )
    return ApiResponse(success=True, data=data)


@router.get("/{mapping_id}", response_model=ApiResponse[BronzeMappingKowilRead])
def get_mapping_kowil(mapping_id: int, db: Session = Depends(get_session)):
    data = service.get_by_id(db, mapping_id)
    return ApiResponse(success=True, data=data)


@router.post("", response_model=ApiResponse[BronzeMappingKowilRead])
def create_mapping_kowil(
    payload: BronzeMappingKowilCreate, db: Session = Depends(get_session)
):
    data = service.create(db, payload)
    return ApiResponse(
        success=True, data=data, message="Mapping kowil created successfully"
    )


@router.post("/batch-add", response_model=ApiResponse[List[BronzeMappingKowilRead]])
def batch_add_mapping_kowil(
    payloads: List[BronzeMappingKowilCreate], db: Session = Depends(get_session)
):
    data = service.batch_add(db, payloads)
    return ApiResponse(
        success=True,
        data=data,
        message=f"{len(data)} mapping kowil created successfully",
    )


@router.put("/{mapping_id}", response_model=ApiResponse[BronzeMappingKowilRead])
def update_mapping_kowil(
    mapping_id: int,
    payload: BronzeMappingKowilUpdate,
    db: Session = Depends(get_session),
):
    data = service.update(db, mapping_id, payload)
    return ApiResponse(
        success=True, data=data, message="Mapping kowil updated successfully"
    )


@router.delete("/{mapping_id}", response_model=ApiResponse[None])
def delete_mapping_kowil(mapping_id: int, db: Session = Depends(get_session)):
    service.delete(db, mapping_id)
    return ApiResponse(
        success=True, data=None, message="Mapping kowil deleted successfully"
    )
