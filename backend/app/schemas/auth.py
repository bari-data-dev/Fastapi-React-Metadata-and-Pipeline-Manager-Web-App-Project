from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, validator


UserRole = Literal["ADMIN", "PARSER-TEAM", "PARSER-INTERN", "MANAGER"]


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=8, max_length=128)

    @validator("username")
    def normalize_username(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not normalized:
            raise ValueError("Username wajib diisi")
        return normalized


class OrchestratorAccessRequest(BaseModel):
    password: str = Field(..., min_length=1, max_length=128)


class AppUserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=1, max_length=191)
    role: UserRole = "PARSER-TEAM"
    is_active: bool = True

    @validator("username")
    def normalize_username(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not normalized:
            raise ValueError("Username wajib diisi")
        return normalized

    @validator("full_name")
    def normalize_full_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Nama lengkap wajib diisi")
        return normalized


class AppUserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=100)
    full_name: Optional[str] = Field(None, min_length=1, max_length=191)
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=8, max_length=128)

    @validator("username")
    def normalize_username(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        normalized = value.strip().lower()
        if not normalized:
            raise ValueError("Username wajib diisi")
        return normalized

    @validator("full_name")
    def normalize_full_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        normalized = value.strip()
        if not normalized:
            raise ValueError("Nama lengkap wajib diisi")
        return normalized


class AppUserRead(BaseModel):
    user_id: int
    username: str
    full_name: str
    role: UserRole
    is_active: bool
    last_login_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AppUserRead
