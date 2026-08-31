from datetime import datetime
from typing import List, cast

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.core.security import hash_password, verify_password
from app.models.app_user import AppUser
from app.schemas.auth import AppUserCreate, AppUserUpdate
from app.services import activity_audit_service


VALID_ROLES = {"ADMIN", "TEAM", "MANAGER", "INTERN"}
ADMIN_EDIT_FIELDS = {"username", "full_name", "password", "role", "is_active"}
MANAGER_EDIT_FIELDS = {"is_active"}
AUDIT_MODULE_KEY = "USER_MANAGEMENT"
AUDIT_MODULE_LABEL = "User Management"
AUDIT_TABLE_NAME = "tools.app_users"
AUDIT_FIELDS = ["username", "full_name", "role", "is_active"]


def get_user_by_username(db: Session, username: str) -> AppUser | None:
    statement = select(AppUser).where(AppUser.username == username.strip().lower())
    return db.exec(statement).one_or_none()


def get_user_by_id(db: Session, user_id: int) -> AppUser:
    statement = select(AppUser).where(AppUser.user_id == user_id)
    user = db.exec(statement).one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User tidak ditemukan",
        )
    return user


def get_all_users(db: Session) -> List[AppUser]:
    return cast(List[AppUser], db.exec(select(AppUser).order_by(AppUser.user_id)).all())


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


def _user_snapshot(user: AppUser) -> dict:
    return {
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role,
        "is_active": user.is_active,
    }


def _user_label(user: AppUser) -> str:
    return f"{user.username} | {user.full_name}"


def create_user(db: Session, payload: AppUserCreate, actor: AppUser) -> AppUser:
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
    batch_id = activity_audit_service.new_batch_id()
    try:
        db.add(user)
        db.flush()
        activity_audit_service.record_activity(
            db,
            module_key=AUDIT_MODULE_KEY,
            module_label=AUDIT_MODULE_LABEL,
            table_name=AUDIT_TABLE_NAME,
            record_id=user.user_id,
            record_label=_user_label(user),
            action=activity_audit_service.ACTION_INSERT,
            current_user=actor,
            changed_fields=AUDIT_FIELDS,
            old_values={},
            new_values=_user_snapshot(user),
            batch_id=batch_id,
        )
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        raise
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
    old_snapshot = _user_snapshot(user)
    password_requested = "password" in update_data and update_data.get("password") is not None

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

    new_snapshot = _user_snapshot(user)
    changed_fields = [
        field
        for field in AUDIT_FIELDS
        if old_snapshot.get(field) != new_snapshot.get(field)
    ]
    old_values = {field: old_snapshot.get(field) for field in changed_fields}
    new_values = {field: new_snapshot.get(field) for field in changed_fields}

    if password_requested:
        changed_fields.append("password")
        old_values["password"] = "[PROTECTED]"
        new_values["password"] = "[CHANGED]"

    user.updated_at = datetime.now()
    batch_id = activity_audit_service.new_batch_id()
    try:
        db.add(user)
        if changed_fields:
            activity_audit_service.record_activity(
                db,
                module_key=AUDIT_MODULE_KEY,
                module_label=AUDIT_MODULE_LABEL,
                table_name=AUDIT_TABLE_NAME,
                record_id=user.user_id,
                record_label=_user_label(user),
                action=activity_audit_service.ACTION_UPDATE,
                current_user=actor,
                changed_fields=changed_fields,
                old_values=old_values,
                new_values=new_values,
                batch_id=batch_id,
            )
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        raise
    return user
