import os
import re
import threading
from pathlib import Path
from typing import Any, Generator

import jaydebeapi

from app.core.config import ENV_PATH


_JTDS_DRIVER_CLASS = "net.sourceforge.jtds.jdbc.Driver"
_CONNECT_LOCK = threading.Lock()
_SCHEMA_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _load_env_if_needed() -> None:
    if not ENV_PATH.exists():
        return
    with ENV_PATH.open("r", encoding="utf-8") as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(
                key.strip(),
                value.strip().strip('"').strip("'"),
            )


def get_crm_schema() -> str:
    _load_env_if_needed()
    schema = (os.getenv("DB_SCHEMA_CRM") or "dbo").strip()
    if not _SCHEMA_PATTERN.fullmatch(schema):
        raise RuntimeError("DB_SCHEMA_CRM tidak valid")
    return schema


def open_crm_connection() -> Any:
    _load_env_if_needed()

    jdbc_url = (os.getenv("JDBC_URL_CRM") or "").strip()
    username = os.getenv("DB_USER_CRM") or ""
    password = os.getenv("DB_PASSWORD_CRM") or ""
    jar_path = Path(os.getenv("JDBC_JAR_CRM") or "")
    driver_name = (os.getenv("DB_DRIVER_CRM") or "JTDS").strip().upper()

    if driver_name != "JTDS":
        raise RuntimeError("DB_DRIVER_CRM harus JTDS untuk koneksi CRM legacy")
    if not jdbc_url or not username or not password:
        raise RuntimeError(
            "Konfigurasi CRM belum lengkap. Periksa JDBC_URL_CRM, DB_USER_CRM, "
            "dan DB_PASSWORD_CRM."
        )
    if not jar_path.is_file():
        raise RuntimeError("JDBC_JAR_CRM tidak ditemukan atau tidak dapat dibaca")

    with _CONNECT_LOCK:
        return jaydebeapi.connect(
            _JTDS_DRIVER_CLASS,
            jdbc_url,
            [username, password],
            str(jar_path),
        )


def get_crm_connection() -> Generator[Any, None, None]:
    connection = open_crm_connection()
    try:
        yield connection
    finally:
        connection.close()
