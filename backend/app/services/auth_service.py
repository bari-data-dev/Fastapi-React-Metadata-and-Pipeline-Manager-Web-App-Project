from datetime import datetime
from typing import List, cast

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.core.security import hash_password, verify_password
from app.models.app_user import AppUser
from app.schemas.auth import AppUserCreate, AppUserUpdate


VALID_ROLES = {"ADMIN", "PARSER-TEAM", "PARSER-INTERN", "MANAGER"}
LEGACY_ROLE_MAP = {"PARSER": "PARSER-TEAM"}
ADMIN_EDIT_FIELDS = {"username", "full_name", "password", "role", "is_active"}
MANAGER_EDIT_FIELDS = {"is_active"}


def _normalize_legacy_role(user: AppUser) -> bool:
    mapped_role = LEGACY_ROLE_MAP.get(user.role)
    if not mapped_role:
        return False
    user.role = mapped_role
    user.updated_at = datetime.now()
    return True


def get_user_by_username(db: Session, username: str) -> AppUser | None:
    statement = select(AppUser).where(AppUser.username == username.strip().lower())
    user = db.exec(statement).one_or_none()
    if user is not None and _normalize_legacy_role(user):
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def get_user_by_id(db: Session, user_id: int) -> AppUser:
    statement = select(AppUser).where(AppUser.user_id == user_id)
    user = db.exec(statement).one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User tidak ditemukan",
        )
    if _normalize_legacy_role(user):
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def get_all_users(db: Session) -> List[AppUser]:
    results = cast(List[AppUser], db.exec(select(AppUser).order_by(AppUser.user_id)).all())
    changed = False
    for user in results:
        if _normalize_legacy_role(user):
            db.add(user)
            changed = True
    if changed:
        db.commit()
        for user in results:
            db.refresh(user)
    return results


def authenticate_user(db: Session, username: str, password: str) -> AppUser:
    user = get_user_by_username(db, username)
    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username atau password salah",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User sudah tidak aktif",
        )
    user.last_login_at = datetime.now()
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_user(db: Session, payload: AppUserCreate) -> AppUser:
    if get_user_by_username(db, payload.username) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username sudah digunakan",
        )
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


def _active_admin_count(db: Session) -> int:
    active_admins = db.exec(
        select(AppUser).where(
            AppUser.role == "ADMIN",
            AppUser.is_active == True,  # noqa: E712
        )
    ).all()
    return len(active_admins)


def _validate_actor_permissions(actor: AppUser, update_data: dict) -> None:
    requested_fields = set(update_data)
    if actor.role == "ADMIN":
        disallowed = requested_fields - ADMIN_EDIT_FIELDS
    elif actor.role == "MANAGER":
        disallowed = requested_fields - MANAGER_EDIT_FIELDS
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Role Anda tidak diperbolehkan mengubah data anggota",
        )

    if disallowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "MANAGER hanya dapat mengaktifkan atau menonaktifkan anggota"
                if actor.role == "MANAGER"
                else "Terdapat field yang tidak diperbolehkan untuk diubah"
            ),
        )


def update_user(
    db: Session,
    user_id: int,
    payload: AppUserUpdate,
    actor: AppUser,
) -> AppUser:
    user = get_user_by_id(db, user_id)
    update_data = payload.dict(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Tidak ada field yang akan diubah",
        )

    _validate_actor_permissions(actor, update_data)

    next_role = update_data.get("role", user.role)
    next_is_active = update_data.get("is_active", user.is_active)

    if actor.user_id == user_id and not next_is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Akun yang sedang digunakan tidak dapat dinonaktifkan",
        )

    if actor.role == "ADMIN" and actor.user_id == user_id and next_role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ADMIN yang sedang login tidak dapat menurunkan role sendiri",
        )

    removes_active_admin = (
        user.role == "ADMIN"
        and user.is_active
        and (next_role != "ADMIN" or not next_is_active)
    )
    if removes_active_admin and _active_admin_count(db) <= 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Minimal satu akun ADMIN aktif harus tetap tersedia",
        )

    username = update_data.pop("username", None)
    if username is not None and username != user.username:
        existing = get_user_by_username(db, username)
        if existing is not None and existing.user_id != user.user_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username sudah digunakan",
            )
        user.username = username

    password = update_data.pop("password", None)
    if password is not None:
        user.password_hash = hash_password(password)

    role = update_data.get("role")
    if role is not None and role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Role tidak valid",
        )

    for field_name, value in update_data.items():
        setattr(user, field_name, value)

    user.updated_at = datetime.now()
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
