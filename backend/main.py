from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routers import all_routers

app = FastAPI(title="Exercise Project 2 API", version="1.0.0")

# CORS
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Daftarkan semua router di list
for r in all_routers:
    # setiap router di file router sudah punya prefixnya sendiri seperti "/clients" atau "/configs"
    # kita tambahkan prefix global "/api" di include sehingga jadi "/api/clients", "/api/configs"
    app.include_router(r, prefix="/api")

# Tanpa auto-create table (sesuai permintaan)
# from app.db.database import engine
# from sqlmodel import SQLModel
# @app.on_event("startup")
# def on_startup():
#     pass


@app.get("/health")
def health():
    return {"status": "ok"}
