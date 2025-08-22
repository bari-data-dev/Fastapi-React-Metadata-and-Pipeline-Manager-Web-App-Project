from .client_router import router as client_router
from .client_config_router import router as client_config_router
from .column_mapping_router import router as column_mapping_router
from .required_columns_router import router as required_columns_router
from .transformation_config_router import router as transformation_config_router
from .integration_config_router import router as integration_config_router
from .integration_dependencies_router import router as integration_dependencies_router
from .mv_refresh_router import router as mv_refresh_router
from .audit_log_router import router as audit_log_router

all_routers = [
    client_router,
    client_config_router,
    column_mapping_router,
    required_columns_router,
    transformation_config_router,
    integration_config_router,
    integration_dependencies_router,
    mv_refresh_router,
    audit_log_router,
]
