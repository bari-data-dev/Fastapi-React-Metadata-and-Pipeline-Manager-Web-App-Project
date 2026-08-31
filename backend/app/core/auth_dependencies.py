from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session

from app.core.security import decode_access_token
from app.db.database import get_session
from app.models.app_user import AppUser
from app.services.auth_service import get_user_by_id


bearer_scheme = HTTPBearer(auto_error=False)
USER_DIRECTORY_ROLES = {"ADMIN", "MANAGER", "TEAM"}


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_session),
) -> AppUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token autentikasi Bearer wajib dikirim",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = int(payload.get("sub"))
        user = get_user_by_id(db, user_id)
    except (ValueError, TypeError, HTTPException):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token tidak valid atau sudah kedaluwarsa",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User sudah tidak aktif",
        )
    return user


def require_roles(*allowed_roles: str):
    def dependency(current_user: AppUser = Depends(get_current_user)) -> AppUser:
        if current_user.role not in set(allowed_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Role Anda tidak memiliki akses ke fitur ini",
            )
        return current_user

    return dependency


def require_admin(current_user: AppUser = Depends(get_current_user)) -> AppUser:
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses hanya diperbolehkan untuk ADMIN",
        )
    return current_user


def require_user_directory_viewer(
    current_user: AppUser = Depends(get_current_user),
) -> AppUser:
    if current_user.role not in USER_DIRECTORY_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User Management tidak tersedia untuk role Anda",
        )
    return current_user
