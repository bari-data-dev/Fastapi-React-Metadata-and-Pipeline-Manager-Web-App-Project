# backend/app/core/config.py
import importlib
import os
import urllib.parse
from pathlib import Path
from typing import List


PROJECT_ROOT = Path(os.getenv("PROJECT_ROOT", "/srv/data_platform")).resolve()
ENV_PATH = PROJECT_ROOT / ".env"


def _load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    try:
        with path.open("r", encoding="utf-8") as fh:
            for raw in fh:
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, val = line.split("=", 1)
                key = key.strip()
                val = val.strip().strip('"').strip("'")
                if key not in os.environ:
                    os.environ[key] = val
    except Exception:
        return


_load_dotenv(ENV_PATH)


class Settings:
    DB_HOST: str
    DB_PORT: int
    DB_NAME: str
    DB_USER: str
    DB_PASSWORD: str
    DB_SCHEMA: str
    DB_ENCRYPT: bool
    DB_TRUST_CERT: bool

    MYSQL_PIPELINE_HOST: str
    MYSQL_PIPELINE_PORT: int
    MYSQL_PIPELINE_DBNAME: str
    MYSQL_PIPELINE_USER: str
    MYSQL_PIPELINE_PASSWORD: str
    MYSQL_PIPELINE_CHARSET: str
    MYSQL_PIPELINE_SSL_DISABLED: bool
    MYSQL_PIPELINE_CONNECT_TIMEOUT: int
    MYSQL_PIPELINE_READ_TIMEOUT: int
    MYSQL_PIPELINE_WRITE_TIMEOUT: int

    APP_HOST: str
    APP_PORT: int
    CORS_ORIGINS: str

    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int

    def __init__(self):
        self.DB_HOST = os.getenv("DB_HOST") or os.getenv("MSSQL_SERVER") or "localhost"
        self.DB_PORT = int(os.getenv("DB_PORT") or os.getenv("MSSQL_PORT") or 1433)
        self.DB_NAME = os.getenv("DB_NAME") or os.getenv("MSSQL_DATABASE") or ""
        self.DB_USER = os.getenv("DB_USER") or os.getenv("MSSQL_USER") or ""
        self.DB_PASSWORD = os.getenv("DB_PASSWORD") or os.getenv("MSSQL_PASSWORD") or ""
        self.DB_SCHEMA = os.getenv("DB_SCHEMA") or "tools"

        def _bool_from_env(key: str, default: bool) -> bool:
            value = os.getenv(key)
            if value is None:
                return default
            return value.strip().lower() in ("1", "true", "yes", "y", "on")

        self.DB_ENCRYPT = _bool_from_env("DB_ENCRYPT", False) or _bool_from_env("MSSQL_ENCRYPT", False)
        self.DB_TRUST_CERT = _bool_from_env("DB_TRUST_CERT", True) or _bool_from_env("MSSQL_TRUST_CERT", True)

        self.MYSQL_PIPELINE_HOST = os.getenv("MYSQL_PIPELINE_HOST", "")
        self.MYSQL_PIPELINE_PORT = int(os.getenv("MYSQL_PIPELINE_PORT", "3306"))
        self.MYSQL_PIPELINE_DBNAME = os.getenv("MYSQL_PIPELINE_DBNAME", "pipeline_bigdata")
        self.MYSQL_PIPELINE_USER = os.getenv("MYSQL_PIPELINE_USER", "")
        self.MYSQL_PIPELINE_PASSWORD = os.getenv("MYSQL_PIPELINE_PASSWORD", "")
        self.MYSQL_PIPELINE_CHARSET = os.getenv("MYSQL_PIPELINE_CHARSET", "utf8mb4")
        self.MYSQL_PIPELINE_SSL_DISABLED = _bool_from_env("MYSQL_PIPELINE_SSL_DISABLED", True)
        self.MYSQL_PIPELINE_CONNECT_TIMEOUT = int(os.getenv("MYSQL_PIPELINE_CONNECT_TIMEOUT", "30"))
        self.MYSQL_PIPELINE_READ_TIMEOUT = int(os.getenv("MYSQL_PIPELINE_READ_TIMEOUT", "600"))
        self.MYSQL_PIPELINE_WRITE_TIMEOUT = int(os.getenv("MYSQL_PIPELINE_WRITE_TIMEOUT", "600"))

        self.APP_HOST = os.getenv("APP_HOST", "0.0.0.0")
        self.APP_PORT = int(os.getenv("APP_PORT", "8000"))
        self.CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")

        self.JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "")
        self.JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
        self.JWT_ACCESS_TOKEN_EXPIRE_MINUTES = int(
            os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "480")
        )
        if not self.JWT_SECRET_KEY:
            raise RuntimeError(
                "JWT_SECRET_KEY belum dikonfigurasi pada environment atau file .env"
            )

    def _detect_odbc_drivers(self) -> List[str]:
        try:
            pyodbc = importlib.import_module("pyodbc")
            return list(pyodbc.drivers())
        except Exception:
            return []

    def get_preferred_driver(self) -> str:
        drivers = self._detect_odbc_drivers()
        preferences = ["ODBC Driver 17 for SQL Server"]
        for preference in preferences:
            if preference in drivers:
                return preference
        for driver in drivers:
            if "sql server" in driver.lower():
                return driver
        raise RuntimeError(
            "No suitable ODBC driver found on this host. Install Microsoft ODBC Driver 17/18 for SQL Server."
        )

    @property
    def DATABASE_URL(self) -> str:
        if not (self.DB_NAME and self.DB_USER and self.DB_PASSWORD):
            raise RuntimeError(
                "Database configuration incomplete. Please set DB_NAME/MSSQL_DATABASE, "
                "DB_USER/MSSQL_USER and DB_PASSWORD/MSSQL_PASSWORD."
            )

        driver_name = self.get_preferred_driver()
        user_enc = urllib.parse.quote_plus(self.DB_USER)
        pwd_enc = urllib.parse.quote_plus(self.DB_PASSWORD)
        driver_enc = urllib.parse.quote_plus(driver_name)
        encrypt = "yes" if self.DB_ENCRYPT else "no"
        trust_cert = "yes" if self.DB_TRUST_CERT else "no"

        return (
            f"mssql+pyodbc://{user_enc}:{pwd_enc}@{self.DB_HOST},{self.DB_PORT}/{self.DB_NAME}"
            f"?driver={driver_enc}&Encrypt={encrypt}&TrustServerCertificate={trust_cert}"
        )

    @property
    def MYSQL_PIPELINE_DATABASE_URL(self) -> str:
        if not (
            self.MYSQL_PIPELINE_HOST
            and self.MYSQL_PIPELINE_DBNAME
            and self.MYSQL_PIPELINE_USER
            and self.MYSQL_PIPELINE_PASSWORD
        ):
            raise RuntimeError(
                "Konfigurasi MySQL pipeline belum lengkap. Isi MYSQL_PIPELINE_HOST, "
                "MYSQL_PIPELINE_DBNAME, MYSQL_PIPELINE_USER, dan MYSQL_PIPELINE_PASSWORD."
            )

        user_enc = urllib.parse.quote_plus(self.MYSQL_PIPELINE_USER)
        password_enc = urllib.parse.quote_plus(self.MYSQL_PIPELINE_PASSWORD)
        database_enc = urllib.parse.quote_plus(self.MYSQL_PIPELINE_DBNAME)
        charset_enc = urllib.parse.quote_plus(self.MYSQL_PIPELINE_CHARSET)

        return (
            f"mysql+pymysql://{user_enc}:{password_enc}@"
            f"{self.MYSQL_PIPELINE_HOST}:{self.MYSQL_PIPELINE_PORT}/{database_enc}"
            f"?charset={charset_enc}"
        )


settings = Settings()
