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


def save_settings_to_env(updates: dict):
    import os
    # Update global settings in-memory
    if "AI_PROVIDER" in updates:
        settings.AI_PROVIDER = updates["AI_PROVIDER"]
    if "AI_BASE_URL" in updates:
        settings.AI_BASE_URL = updates["AI_BASE_URL"]
        settings.OLLAMA_BASE_URL = updates["AI_BASE_URL"]
    if "AI_MODEL" in updates:
        settings.AI_MODEL = updates["AI_MODEL"]
        settings.OLLAMA_MODEL = updates["AI_MODEL"]
    if "AI_API_KEY" in updates:
        settings.AI_API_KEY = updates["AI_API_KEY"]

    env_path = ".env"
    possible_paths = [
        ".env",
        "backend/.env",
        "/Users/imamimam/Documents/auto RPS obe/backend/.env"
    ]
    for p in possible_paths:
        if os.path.exists(p):
            env_path = p
            break

    # Read existing content
    lines = []
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
        except Exception as e:
            print(f"[SAVE ENV ERROR] Reading failed: {e}")

    updated_keys = set()
    new_lines = []
    for line in lines:
        stripped = line.strip()
        if "=" in line and not stripped.startswith("#"):
            key, val = line.split("=", 1)
            key = key.strip()
            if key in updates:
                new_lines.append(f"{key}={updates[key]}\n")
                updated_keys.add(key)
                continue
            # Also sync legacy keys if they are in the updates
            if key == "OLLAMA_BASE_URL" and "AI_BASE_URL" in updates:
                new_lines.append(f"OLLAMA_BASE_URL={updates['AI_BASE_URL']}\n")
                updated_keys.add(key)
                continue
            if key == "OLLAMA_MODEL" and "AI_MODEL" in updates:
                new_lines.append(f"OLLAMA_MODEL={updates['AI_MODEL']}\n")
                updated_keys.add(key)
                continue
        new_lines.append(line)

    for key, val in updates.items():
        if key not in updated_keys:
            new_lines.append(f"{key}={val}\n")
            
    # Also add legacy keys if they weren't in the file and we updated their new equivalents
    if "OLLAMA_BASE_URL" not in updated_keys and "AI_BASE_URL" in updates:
        new_lines.append(f"OLLAMA_BASE_URL={updates['AI_BASE_URL']}\n")
    if "OLLAMA_MODEL" not in updated_keys and "AI_MODEL" in updates:
        new_lines.append(f"OLLAMA_MODEL={updates['AI_MODEL']}\n")

    try:
        with open(env_path, "w", encoding="utf-8") as f:
            f.writelines(new_lines)
    except Exception as e:
        print(f"[SAVE ENV ERROR] Writing failed: {e}")

