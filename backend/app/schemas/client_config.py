# backend/app/schemas/client_config.py
from typing import Optional, List
from pydantic import BaseModel


class ClientConfigBase(BaseModel):
    client_id: int
    source_type: str
    target_schema: str
    target_table: str
    source_config: Optional[dict] = None
    is_active: Optional[bool] = True
    # config_version: Optional[str] = None
    logical_source_file: Optional[str] = None


class ClientConfigCreate(ClientConfigBase):
    # Config_id not present for create (DB will assign)
    pass


class ClientConfigRead(ClientConfigBase):
    config_id: int


class ClientConfigUpdate(BaseModel):
    # partial update: all optional
    client_id: Optional[int] = None
    source_type: Optional[str] = None
    target_schema: Optional[str] = None
    target_table: Optional[str] = None
    source_config: Optional[dict] = None
    is_active: Optional[bool] = None
    # config_version: Optional[str] = None
    logical_source_file: Optional[str] = None


class BatchConfigSaveRequest(BaseModel):
    # no config_version anymore; we accept a list of configs to save
    client_configs: List[ClientConfigCreate]
