import re
import threading
from pathlib import Path
from typing import Any, Generator

import jaydebeapi

from app.core.config import settings


_JTDS_DRIVER_CLASS = "net.sourceforge.jtds.jdbc.Driver"
_CONNECT_LOCK = threading.Lock()
_SCHEMA_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def get_crm_schema() -> str:
    schema = settings.DB_SCHEMA_CRM.strip() or "dbo"
    if not _SCHEMA_PATTERN.fullmatch(schema):
        raise RuntimeError("DB_SCHEMA_CRM tidak valid")
    return schema


def open_crm_connection() -> Any:
    settings.validate_crm_jdbc()

    driver_name = settings.DB_DRIVER_CRM.strip().upper()
    jar_path = Path(settings.JDBC_JAR_CRM)

    if driver_name != "JTDS":
        raise RuntimeError("DB_DRIVER_CRM harus JTDS untuk koneksi CRM legacy")
    if not jar_path.is_file():
        raise RuntimeError("JDBC_JAR_CRM tidak ditemukan atau tidak dapat dibaca")

    with _CONNECT_LOCK:
        return jaydebeapi.connect(
            _JTDS_DRIVER_CLASS,
            settings.JDBC_URL_CRM,
            [settings.DB_USER_CRM, settings.DB_PASSWORD_CRM],
            str(jar_path),
        )


def get_crm_connection() -> Generator[Any, None, None]:
    connection = open_crm_connection()
    try:
        yield connection
    finally:
        connection.close()
