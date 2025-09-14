# backend/app/schemas/integration_dependencies.py
from typing import Optional
from sqlmodel import SQLModel


class IntegrationDependencyBase(SQLModel):
    client_id: int
    fact_proc_name: str
    dim_proc_name: str
    is_active: Optional[bool] = True


class IntegrationDependencyCreate(IntegrationDependencyBase):
    pass


class IntegrationDependencyRead(IntegrationDependencyBase):
    dependency_id: int


class IntegrationDependencyUpdate(SQLModel):
    client_id: Optional[int] = None
    fact_proc_name: Optional[str] = None
    dim_proc_name: Optional[str] = None
    is_active: Optional[bool] = True
