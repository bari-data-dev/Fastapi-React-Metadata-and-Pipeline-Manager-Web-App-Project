from .artbst_router import router as artbst_router
from .auth_router import router as auth_router
from .odists_parsing_router import router as odists_parsing_router
from .parsing_report_router import router as parsing_report_router
from .produk_distributor_router import router as produk_distributor_router


all_routers = [
    auth_router,
    odists_parsing_router,
    parsing_report_router,
    produk_distributor_router,
    artbst_router,
]
