from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx
from app.services.ollama_service import ai_service
from app.core.config import settings, save_settings_to_env

router = APIRouter(prefix="/ollama", tags=["Ollama"])


class AIConfig(BaseModel):
    provider: Optional[str] = "ollama"
    base_url: str
    model: str
    api_key: Optional[str] = ""


@router.get("/status")
async def check_ai():
    available = await ai_service.check_available()
    return {
        "available": available,
        "provider": ai_service.provider,
        "base_url": ai_service.base_url,
        "model": ai_service.model,
        "api_key": ai_service.api_key,
    }


@router.get("/models")
async def list_models():
    try:
        models = await ai_service.list_models()
        return {"models": models}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/configure")
async def configure_ai(config: AIConfig):
    """Update AI provider, host, model & api_key di runtime."""
    base_url = config.base_url.rstrip("/")
    ai_service.provider = config.provider or "ollama"
    ai_service.base_url = base_url
    ai_service.model = config.model
    ai_service.api_key = config.api_key or ""

    ai_service.client = httpx.AsyncClient(
        base_url=base_url,
        timeout=ai_service.timeout,
    )
    available = await ai_service.check_available()

    # Save updates permanently to .env file
    save_settings_to_env({
        "AI_PROVIDER": ai_service.provider,
        "AI_BASE_URL": ai_service.base_url,
        "AI_MODEL": ai_service.model,
        "AI_API_KEY": ai_service.api_key,
    })

    return {
        "success": True,
        "available": available,
        "provider": ai_service.provider,
        "base_url": base_url,
        "model": config.model,
        "has_api_key": bool(ai_service.api_key),
    }

