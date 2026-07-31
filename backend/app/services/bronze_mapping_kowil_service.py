# backend/app/services/bronze_mapping_kowil_service.py
from typing import List, Optional, cast

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models.bronze_mapping_kowil import BronzeMappingKowil
from app.schemas.bronze_mapping_kowil import (
    BronzeMappingKowilCreate,
    BronzeMappingKowilUpdate,
)


def get_all(
    db: Session,
    kowil_lama_2024: Optional[str] = None,
    kowil_baru_feb25: Optional[str] = None,
    kowil_baru_sept25: Optional[str] = None,
    spv_2: Optional[str] = None,
    asm_2: Optional[str] = None,
    rsm: Optional[str] = None,
    nama_asm: Optional[str] = None,
    nama_karyawan: Optional[str] = None,
    nama_mso: Optional[str] = None,
    source_sheet: Optional[str] = None,
) -> List[BronzeMappingKowil]:
    stmt = select(BronzeMappingKowil)

    if kowil_lama_2024 is not None:
        stmt = stmt.where(BronzeMappingKowil.kowil_lama_2024 == kowil_lama_2024)
    if kowil_baru_feb25 is not None:
        stmt = stmt.where(BronzeMappingKowil.kowil_baru_feb25 == kowil_baru_feb25)
    if kowil_baru_sept25 is not None:
        stmt = stmt.where(BronzeMappingKowil.kowil_baru_sept25 == kowil_baru_sept25)

    if spv_2 is not None:
        stmt = stmt.where(BronzeMappingKowil.spv_2 == spv_2)
    if asm_2 is not None:
        stmt = stmt.where(BronzeMappingKowil.asm_2 == asm_2)
    if rsm is not None:
        stmt = stmt.where(BronzeMappingKowil.rsm == rsm)

    if nama_asm is not None:
        stmt = stmt.where(BronzeMappingKowil.nama_asm == nama_asm)
    if nama_karyawan is not None:
        stmt = stmt.where(BronzeMappingKowil.nama_karyawan == nama_karyawan)
    if nama_mso is not None:
        stmt = stmt.where(BronzeMappingKowil.nama_mso == nama_mso)

    if source_sheet is not None:
        stmt = stmt.where(BronzeMappingKowil.source_sheet == source_sheet)

    results = db.exec(stmt)
    return cast(List[BronzeMappingKowil], results.all())


def get_by_id(db: Session, mapping_id: int) -> BronzeMappingKowil:
    stmt = select(BronzeMappingKowil).where(BronzeMappingKowil.mapping_id == mapping_id)
    result = db.exec(stmt).one_or_none()
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bronze mapping kowil not found",
        )
    return result


def create(db: Session, payload: BronzeMappingKowilCreate) -> BronzeMappingKowil:
    data = payload.dict()

    # semua nullable di DB, tapi guard supaya tidak insert row kosong total
    if not any(v is not None and str(v).strip() != "" for v in data.values()):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one field must be provided",
        )

    obj = BronzeMappingKowil(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def batch_add(
    db: Session, payloads: List[BronzeMappingKowilCreate]
) -> List[BronzeMappingKowil]:
    created: List[BronzeMappingKowil] = []

    for p in payloads:
        data = p.dict()
        if not any(v is not None and str(v).strip() != "" for v in data.values()):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Each item must include at least one non-empty field",
            )

        obj = BronzeMappingKowil(**data)
        db.add(obj)
        created.append(obj)

    db.commit()
    for obj in created:
        db.refresh(obj)
    return created


def update(
    db: Session, mapping_id: int, payload: BronzeMappingKowilUpdate
) -> BronzeMappingKowil:
    obj = get_by_id(db, mapping_id)
    data = payload.dict(exclude_unset=True)

    if not data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No fields provided to update",
        )

    # kalau ada string kosong, normalisasi jadi None (optional)
    for k, v in list(data.items()):
        if isinstance(v, str) and v.strip() == "":
            data[k] = None

    for k, v in data.items():
        setattr(obj, k, v)

    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def delete(db: Session, mapping_id: int) -> None:
    obj = get_by_id(db, mapping_id)
    db.delete(obj)
    db.commit()
