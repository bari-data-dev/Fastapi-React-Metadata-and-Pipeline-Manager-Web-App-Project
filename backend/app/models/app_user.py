from datetime import datetime
from typing import ClassVar, Optional

from sqlmodel import Field, SQLModel


class AppUser(SQLModel, table=True):
    __tablename__: ClassVar[str] = "app_users"
    __table_args__ = {"schema": "tools"}

    user_id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(max_length=100, index=True)
    password_hash: str = Field(max_length=255)
    full_name: str = Field(max_length=191)
    role: str = Field(max_length=50)
    is_active: bool = Field(default=True)
    last_login_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
