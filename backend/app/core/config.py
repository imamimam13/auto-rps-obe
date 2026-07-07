from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    APP_NAME: str = "Auto RPS OBE AI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./autorps.db"
    DATABASE_ECHO: bool = False

    # AI Provider (ollama, lmstudio, openai, 9router)
    AI_PROVIDER: str = "ollama"
    AI_BASE_URL: str = "http://localhost:11434"
    AI_MODEL: str = "llama3.1:8b"
    AI_API_KEY: str = ""
    AI_TIMEOUT: int = 120

    # Legacy env names — mapped to AI_*
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.1:8b"
    OLLAMA_TIMEOUT: int = 120

    # JWT
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # CORS
    ALLOWED_ORIGINS: List[str] = ["*"]

    # File Upload
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE: int = 10 * 1024 * 1024

    # Export
    EXPORT_DIR: str = "exports"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

# Resolve legacy → AI_*
if settings.OLLAMA_BASE_URL != "http://localhost:11434":
    settings.AI_BASE_URL = settings.OLLAMA_BASE_URL
if settings.OLLAMA_MODEL != "llama3.1:8b":
    settings.AI_MODEL = settings.OLLAMA_MODEL
if settings.OLLAMA_TIMEOUT != 120:
    settings.AI_TIMEOUT = settings.OLLAMA_TIMEOUT
