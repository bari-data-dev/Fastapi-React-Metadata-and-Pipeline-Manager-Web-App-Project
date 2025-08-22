# backend/app/routers/client_router.py
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.db.database import get_session
from app.schemas.client import ClientCreate, ClientUpdate, ClientRead
from app.services import client_service
from app.types import ApiResponse

router = APIRouter(prefix="/clients", tags=["Client Reference"])


@router.get("", response_model=ApiResponse[List[ClientRead]])
def list_clients(
    client_id: Optional[int] = Query(None, description="Filter by client_id"),
    db: Session = Depends(get_session),
):
    data = client_service.get_all(db, client_id=client_id)
    return ApiResponse(success=True, data=data)


@router.get("/{client_id}", response_model=ApiResponse[ClientRead])
def get_client(client_id: int, db: Session = Depends(get_session)):
    data = client_service.get_by_id(db, client_id)
    return ApiResponse(success=True, data=data)


@router.post("", response_model=ApiResponse[ClientRead])
def create_client(payload: ClientCreate, db: Session = Depends(get_session)):
    data = client_service.create(db, payload)
    return ApiResponse(success=True, data=data, message="Client created successfully")


@router.post("/batch-add", response_model=ApiResponse[List[ClientRead]])
def batch_add_clients(payloads: List[ClientCreate], db: Session = Depends(get_session)):
    data = client_service.batch_add(db, payloads)
    return ApiResponse(
        success=True, data=data, message=f"{len(data)} clients created successfully"
    )


@router.put("/{client_id}", response_model=ApiResponse[ClientRead])
def update_client(
    client_id: int, payload: ClientUpdate, db: Session = Depends(get_session)
):
    data = client_service.update(db, client_id, payload)
    return ApiResponse(success=True, data=data, message="Client updated successfully")


@router.delete("/{client_id}", response_model=ApiResponse[None])
def delete_client(client_id: int, db: Session = Depends(get_session)):
    client_service.delete(db, client_id)
    return ApiResponse(success=True, data=None, message="Client deleted successfully")
