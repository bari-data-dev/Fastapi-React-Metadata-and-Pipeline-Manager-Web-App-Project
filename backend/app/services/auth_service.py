from datetime import datetime
from typing import List, cast

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.core.security import hash_password, verify_password
from app.models.app_user import AppUser
from app.schemas.auth import AppUserCreate, AppUserUpdate


def get_user_by_username(db: Session, username: str) -> AppUser | None:
    statement = select(AppUser).where(AppUser.username == username.strip().lower())
    return db.exec(statement).one_or_none()


def get_user_by_id(db: Session, user_id: int) -> AppUser:
    statement = select(AppUser).where(AppUser.user_id == user_id)
    user = db.exec(statement).one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User tidak ditemukan")
    return user


def get_all_users(db: Session) -> List[AppUser]:
    results = db.exec(select(AppUser).order_by(AppUser.user_id))
    return cast(List[AppUser], results.all())


def authenticate_user(db: Session, username: str, password: str) -> AppUser:
    user = get_user_by_username(db, username)
    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username atau password salah",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User sudah tidak aktif")
    user.last_login_at = datetime.now()
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_user(db: Session, payload: AppUserCreate) -> AppUser:
    if get_user_by_username(db, payload.username) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username sudah digunakan")
    user = AppUser(
        username=payload.username,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
        is_active=payload.is_active,
        created_at=datetime.now(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user(db: Session, user_id: int, payload: AppUserUpdate) -> AppUser:
    user = get_user_by_id(db, user_id)
    update_data = payload.dict(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Tidak ada field yang akan diubah",
        )
    password = update_data.pop("password", None)
    if password is not None:
        user.password_hash = hash_password(password)
    for field_name, value in update_data.items():
        setattr(user, field_name, value)
    user.updated_at = datetime.now()
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
