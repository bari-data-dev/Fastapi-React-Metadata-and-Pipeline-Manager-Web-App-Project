# backend/app/db/database.py
from typing import Any, Generator, Optional

from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import Session, create_engine

from app.core.config import settings


engine = create_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    class_=Session,
)

_mysql_pipeline_engine: Optional[Engine] = None
_mysql_pipeline_session_factory = None


def _get_mysql_pipeline_session_factory():
    global _mysql_pipeline_engine
    global _mysql_pipeline_session_factory

    if _mysql_pipeline_session_factory is None:
        _mysql_pipeline_engine = create_engine(
            settings.MYSQL_PIPELINE_DATABASE_URL,
            echo=False,
            pool_pre_ping=True,
            pool_recycle=1800,
            pool_size=5,
            max_overflow=5,
            connect_args={
                "connect_timeout": settings.MYSQL_PIPELINE_CONNECT_TIMEOUT,
                "read_timeout": settings.MYSQL_PIPELINE_READ_TIMEOUT,
                "write_timeout": settings.MYSQL_PIPELINE_WRITE_TIMEOUT,
            },
        )
        _mysql_pipeline_session_factory = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=_mysql_pipeline_engine,
            class_=Session,
        )

    return _mysql_pipeline_session_factory


def get_session() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_mysql_pipeline_session() -> Generator[Session, None, None]:
    factory = _get_mysql_pipeline_session_factory()
    db = factory()
    try:
        yield db
    finally:
        db.close()


def get_crm_connection() -> Generator[Any, None, None]:
    settings.validate_crm_jdbc()

    import jaydebeapi

    connection = jaydebeapi.connect(
        "net.sourceforge.jtds.jdbc.Driver",
        settings.JDBC_URL_CRM,
        [settings.DB_USER_CRM, settings.DB_PASSWORD_CRM],
        settings.JDBC_JAR_CRM,
    )
    try:
        yield connection
    finally:
        connection.close()
