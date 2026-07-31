# backend/app/core/config.py
import os
from pathlib import Path
from typing import Optional, List
import urllib.parse
import importlib


# -------------------------
# Load .env file (simple parser) so settings work even if pydantic .env not used
# -------------------------
ENV_PATH = Path("D:/data_platform/.env").resolve()  # sesuaikan jika perlu

def _load_dotenv(path: Path) -> None:
    """
    Simple .env loader: membaca KEY=VALUE, mengabaikan comment lines (#).
    Tidak membutuhkan python-dotenv dependency.
    """
    if not path.exists():
        return
    try:
        with path.open("r", encoding="utf-8") as fh:
            for raw in fh:
                line = raw.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" not in line:
                    continue
                key, val = line.split("=", 1)
                key = key.strip()
                val = val.strip().strip('"').strip("'")
                # don't overwrite existing environment variables
                if key not in os.environ:
                    os.environ[key] = val
    except Exception:
        # best-effort; don't crash on parse error
        return

_load_dotenv(ENV_PATH)


# -------------------------
# Settings (simple, explicit)
# -------------------------
class Settings:
    # prefer DB_* vars but also support MSSQL_* naming used di autoloader
    DB_HOST: str
    DB_PORT: int
    DB_NAME: str
    DB_USER: str
    DB_PASSWORD: str
    DB_SCHEMA: str
    DB_ENCRYPT: bool
    DB_TRUST_CERT: bool

    APP_HOST: str
    APP_PORT: int
    CORS_ORIGINS: str

    def __init__(self):
        # read with fallback from MSSQL_* names
        self.DB_HOST = os.getenv("DB_HOST") or os.getenv("MSSQL_SERVER") or "localhost"
        self.DB_PORT = int(os.getenv("DB_PORT") or os.getenv("MSSQL_PORT") or 1433)
        self.DB_NAME = os.getenv("DB_NAME") or os.getenv("MSSQL_DATABASE") or ""
        self.DB_USER = os.getenv("DB_USER") or os.getenv("MSSQL_USER") or ""
        self.DB_PASSWORD = os.getenv("DB_PASSWORD") or os.getenv("MSSQL_PASSWORD") or ""
        self.DB_SCHEMA = os.getenv("DB_SCHEMA") or "tools"
        # allow values like "true"/"false"
        def _bool_from_env(k, default: bool):
            v = os.getenv(k)
            if v is None:
                return default
            v2 = v.strip().lower()
            return v2 in ("1", "true", "yes", "y", "on")
        self.DB_ENCRYPT = _bool_from_env("DB_ENCRYPT", False) or _bool_from_env("MSSQL_ENCRYPT", False)
        self.DB_TRUST_CERT = _bool_from_env("DB_TRUST_CERT", True) or _bool_from_env("MSSQL_TRUST_CERT", True)

        self.APP_HOST = os.getenv("APP_HOST", "0.0.0.0")
        self.APP_PORT = int(os.getenv("APP_PORT", 8000))
        self.CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")

    # -------------------------
    # Detect ODBC drivers (if pyodbc available)
    # -------------------------
    def _detect_odbc_drivers(self) -> List[str]:
        try:
            pyodbc = importlib.import_module("pyodbc")
            return list(pyodbc.drivers())
        except Exception:
            return []

    def get_preferred_driver(self) -> str:
        """
        Return driver name string that should be used in the connection URL.
        Preference order: ODBC Driver 18 -> 17 -> 13 -> 11 -> legacy 'SQL Server'.
        Raises RuntimeError if nothing suitable is found.
        """
        drivers = self._detect_odbc_drivers()
        preferences = [
            #"ODBC Driver 18 for SQL Server",
            "ODBC Driver 17 for SQL Server",
            #"ODBC Driver 13 for SQL Server",
            #"ODBC Driver 11 for SQL Server",
            #"SQL Server",
        ]
        for p in preferences:
            if p in drivers:
                return p
        # fallback: pick any driver with 'sql server' in name
        for d in drivers:
            if "sql server" in d.lower():
                return d
        # if no drivers found, raise with helpful message
        raise RuntimeError(
            "No suitable ODBC driver found on this host. "
            "Install Microsoft ODBC Driver 17/18 for SQL Server, or ensure a 'SQL Server' driver exists."
        )

    # -------------------------
    # DATABASE_URL used by SQLAlchemy
    # -------------------------
    @property
    def DATABASE_URL(self) -> str:
        if not (self.DB_NAME and self.DB_USER and self.DB_PASSWORD):
            raise RuntimeError(
                "Database configuration incomplete. Please set DB_NAME/MSSQL_DATABASE, "
                "DB_USER/MSSQL_USER and DB_PASSWORD/MSSQL_PASSWORD in environment or .env"
            )

        # pick driver (this may throw RuntimeError if none installed)
        driver_name = self.get_preferred_driver()

        # URL encode credentials and driver
        user_enc = urllib.parse.quote_plus(self.DB_USER)
        pwd_enc = urllib.parse.quote_plus(self.DB_PASSWORD)
        driver_enc = urllib.parse.quote_plus(driver_name)

        encrypt = "yes" if self.DB_ENCRYPT else "no"
        trust_cert = "yes" if self.DB_TRUST_CERT else "no"

        # format: host,port for SQL Server DSN-style
        return (
            f"mssql+pyodbc://{user_enc}:{pwd_enc}@{self.DB_HOST},{self.DB_PORT}/{self.DB_NAME}"
            f"?driver={driver_enc}&Encrypt={encrypt}&TrustServerCertificate={trust_cert}"
        )


# single settings instance
settings = Settings()
