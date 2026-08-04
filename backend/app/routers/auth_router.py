import secrets
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.core.auth_dependencies import get_current_user, require_admin
from app.core.config import settings
from app.core.security import create_access_token
from app.db.database import get_session
from app.models.app_user import AppUser
from app.schemas.auth import (
    AppUserCreate,
    AppUserRead,
    AppUserUpdate,
    LoginRequest,
    LoginResponse,
    OrchestratorAccessRequest,
)
from app.services import auth_service
from app.types import ApiResponse


router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=ApiResponse[LoginResponse])
def login(payload: LoginRequest, db: Session = Depends(get_session)):
    user = auth_service.authenticate_user(db, payload.username, payload.password)
    access_token = create_access_token(
        subject=str(user.user_id),
        additional_claims={"username": user.username, "role": user.role},
    )
    return ApiResponse(
        success=True,
        data=LoginResponse(
            access_token=access_token,
            token_type="bearer",
            user=AppUserRead.from_orm(user),
        ),
        message="Login berhasil",
    )


@router.get("/me", response_model=ApiResponse[AppUserRead])
def get_logged_in_user(current_user: AppUser = Depends(get_current_user)):
    return ApiResponse(success=True, data=AppUserRead.from_orm(current_user))


@router.post("/orchestrator-access", response_model=ApiResponse[dict])
def validate_orchestrator_access(
    payload: OrchestratorAccessRequest,
    _: AppUser = Depends(get_current_user),
):
    if not settings.ORCHESTRATOR_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password orchestrator belum dikonfigurasi pada server",
        )

    if not secrets.compare_digest(payload.password, settings.ORCHESTRATOR_PASSWORD):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Password orchestrator salah",
        )

    return ApiResponse(
        success=True,
        data={"url": settings.PREFECT_UI_URL},
        message="Akses orchestrator disetujui",
    )


@router.get("/users", response_model=ApiResponse[List[AppUserRead]])
def list_users(
    db: Session = Depends(get_session),
    _: AppUser = Depends(require_admin),
):
    return ApiResponse(
        success=True,
        data=[AppUserRead.from_orm(user) for user in auth_service.get_all_users(db)],
    )


@router.post("/users", response_model=ApiResponse[AppUserRead])
def create_user(
    payload: AppUserCreate,
    db: Session = Depends(get_session),
    _: AppUser = Depends(require_admin),
):
    user = auth_service.create_user(db, payload)
    return ApiResponse(
        success=True,
        data=AppUserRead.from_orm(user),
        message="User berhasil dibuat",
    )


@router.put("/users/{user_id}", response_model=ApiResponse[AppUserRead])
def update_user(
    user_id: int,
    payload: AppUserUpdate,
    db: Session = Depends(get_session),
    current_admin: AppUser = Depends(require_admin),
):
    user = auth_service.update_user(
        db,
        user_id,
        payload,
        actor_user_id=current_admin.user_id,
    )
    return ApiResponse(
        success=True,
        data=AppUserRead.from_orm(user),
        message="User berhasil diperbarui",
    )
