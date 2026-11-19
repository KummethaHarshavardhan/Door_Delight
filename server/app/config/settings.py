from functools import lru_cache
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_ENV_FILE = Path(__file__).resolve().parents[3] / ".env"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # App
    APP_NAME: str = "DoorDelight"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # MongoDB
    MONGODB_URI: str = "mongodb://localhost:27017/doordelight"
    MONGODB_DB_NAME: str = "doordelight"

    # JWT
    JWT_SECRET: str = "dev-only-fallback-secret-change-in-env"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120

    # Initial Admin
    ADMIN_EMAIL: str = ""
    ADMIN_PASSWORD: str = ""

    # Google Gemini AI
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # Razorpay
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""

    # CORS / URLs
    CLIENT_URL: str = "http://localhost:5173"
    BACKEND_URL: str = "http://localhost:8000"

    # Upload & Private KYC storage directories
    UPLOAD_DIR: str = "uploads"
    PRIVATE_KYC_DIR: str = "private_uploads/kyc"
    KYC_ENCRYPTION_KEY: str = ""

    # Road Routing (OSRM / OpenRouteService)
    OSRM_BASE_URL: str = "https://router.project-osrm.org"
    ORS_API_KEY: str = ""

    # COD Settlement & Optional SMS Provider (Twilio)
    COD_OVERDUE_DAYS: int = 2
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM_NUMBER: str = ""

    model_config = SettingsConfigDict(
        env_file=(str(ROOT_ENV_FILE), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins(self) -> List[str]:
        origins = [
            self.CLIENT_URL,
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
        ]
        return list(dict.fromkeys([o for o in origins if o]))


@lru_cache()
def get_settings() -> Settings:
    return Settings()
