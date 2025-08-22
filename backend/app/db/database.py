# backend/app/db/database.py
from sqlmodel import create_engine, Session
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from typing import Generator

# create_engine dari sqlmodel (wraps sqlalchemy)
engine = create_engine(settings.DATABASE_URL, echo=False, pool_pre_ping=True)

# IMPORTANT: class_ must be sqlmodel.Session so produced sessions are sqlmodel Session
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    class_=Session,
)

def get_session() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
