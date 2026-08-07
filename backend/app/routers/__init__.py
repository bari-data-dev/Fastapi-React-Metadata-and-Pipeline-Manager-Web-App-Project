from .auth_router import router as auth_router
from .odists_parsing_router import router as odists_parsing_router
from .parsing_report_router import router as parsing_report_router


all_routers = [
    auth_router,
    odists_parsing_router,
    parsing_report_router,
]
