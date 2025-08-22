# backend/app/core/config.py
from typing import Optional
from pydantic import BaseSettings

class Settings(BaseSettings):
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: Optional[str] = None
    DB_USER: Optional[str] = None
    DB_PASSWORD: Optional[str] = None
    DB_SCHEMA: str = "tools"

    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    CORS_ORIGINS: str = "*"

    @property
    def DATABASE_URL(self) -> str:
        if not (self.DB_NAME and self.DB_USER and self.DB_PASSWORD):
            raise RuntimeError(
                "Database configuration incomplete. Please set DB_NAME, DB_USER and DB_PASSWORD in .env"
            )
        return f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
