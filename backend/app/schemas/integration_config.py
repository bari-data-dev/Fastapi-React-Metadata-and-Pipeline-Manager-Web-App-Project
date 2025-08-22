# backend/app/schemas/integration_config.py
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class IntegrationConfigBase(BaseModel):
    client_id: int = Field(..., description="Client ID")
    proc_name: str = Field(..., description="Procedure name")
    is_active: Optional[bool] = Field(default=True)
    created_by: Optional[str] = Field(default=None)
    table_type: Optional[str] = Field(default=None)
    run_order: Optional[int] = Field(default=None)


class IntegrationConfigCreate(IntegrationConfigBase):
    pass


class IntegrationConfigRead(IntegrationConfigBase):
    integration_id: int
    created_at: Optional[datetime]


class IntegrationConfigUpdate(BaseModel):
    client_id: Optional[int] = None
    proc_name: Optional[str] = None
    is_active: Optional[bool] = None
    created_by: Optional[str] = None
    table_type: Optional[str] = None
    run_order: Optional[int] = None
