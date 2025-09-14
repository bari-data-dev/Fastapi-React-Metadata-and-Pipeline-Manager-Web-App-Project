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
    logical_source_file: Optional[str] = None
    source_system: str 


class ClientConfigCreate(ClientConfigBase):
    pass


class ClientConfigRead(ClientConfigBase):
    config_id: int


class ClientConfigUpdate(BaseModel):
    client_id: Optional[int] = None
    source_type: Optional[str] = None
    target_schema: Optional[str] = None
    target_table: Optional[str] = None
    source_config: Optional[dict] = None
    is_active: Optional[bool] = None
    logical_source_file: Optional[str] = None
    source_system: Optional[str] = None


class BatchConfigSaveRequest(BaseModel):
    client_configs: List[ClientConfigCreate]
