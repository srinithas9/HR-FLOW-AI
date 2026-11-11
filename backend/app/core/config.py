from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "AI-Powered HR Operations & Action Intelligence Platform"
    APP_ENV: str = "development"
    APP_PORT: int = 8000
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"
    TIMEZONE: str = "Asia/Kolkata"

    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "hr_operations_db"
    DATABASE_URL: Optional[str] = None

    # Security & JWT Configuration
    JWT_SECRET_KEY: str = "d48e89f812b1897c8d9e6f5421a309e1c278912e3f4b5a6c7d8e9f0a1b2c3d4e"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    DEFAULT_USER_PASSWORD: str = "Password@123"

    # CORS Settings
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # LLM & GenAI Configuration (Module 7B)
    LLM_PROVIDER: str = "gemini"  # gemini, openai, or generic openai-compatible
    LLM_API_KEY: Optional[str] = None
    LLM_MODEL: str = "gemini-2.5-flash"  # Latest stable Gemini reasoning model with function calling
    LLM_BASE_URL: Optional[str] = None
    LLM_TIMEOUT: int = 30
    LLM_MAX_TOOL_ROUNDS: int = 4

    @property
    def sync_database_url(self) -> str:
        if self.DATABASE_URL:
            # Replace postgresql:// with postgresql+psycopg:// if needed
            if self.DATABASE_URL.startswith("postgresql://"):
                return self.DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)
            return self.DATABASE_URL
        return f"postgresql+psycopg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()

