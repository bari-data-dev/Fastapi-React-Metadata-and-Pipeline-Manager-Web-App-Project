# backend/app/schemas/mv_refresh.py
from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class MvRefreshConfigBase(BaseModel):
    client_id: int
    mv_proc_name: str
    is_active: Optional[bool] = True
    refresh_mode: Optional[str] = None


class MvRefreshConfigCreate(MvRefreshConfigBase):
    created_by: Optional[str] = None


class MvRefreshConfigUpdate(BaseModel):
    client_id: Optional[int] = None
    mv_proc_name: Optional[str] = None
    is_active: Optional[bool] = None
    refresh_mode: Optional[str] = None
    created_by: Optional[str] = None


class MvRefreshConfigRead(MvRefreshConfigBase):
    mv_id: int
    created_at: datetime
    created_by: Optional[str] = None

    class Config:
        orm_mode = True
