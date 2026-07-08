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


class BrandingConfig(BaseModel):
    brand_campus_name: str
    brand_campus_logo_url: Optional[str] = ""
    default_koordinator_pengembang: Optional[str] = ""
    default_koordinator_rmk: Optional[str] = ""
    default_ka_prodi: Optional[str] = ""


@router.get("/branding")
async def get_branding():
    return {
        "brand_campus_name": settings.BRAND_CAMPUS_NAME,
        "brand_campus_logo_url": settings.BRAND_CAMPUS_LOGO_URL,
        "default_koordinator_pengembang": settings.DEFAULT_KOORDINATOR_PENGEMBANG,
        "default_koordinator_rmk": settings.DEFAULT_KOORDINATOR_RMK,
        "default_ka_prodi": settings.DEFAULT_KA_PRODI,
    }


@router.post("/branding")
async def update_branding(config: BrandingConfig):
    settings.BRAND_CAMPUS_NAME = config.brand_campus_name
    settings.BRAND_CAMPUS_LOGO_URL = config.brand_campus_logo_url or ""
    settings.DEFAULT_KOORDINATOR_PENGEMBANG = config.default_koordinator_pengembang or ""
    settings.DEFAULT_KOORDINATOR_RMK = config.default_koordinator_rmk or ""
    settings.DEFAULT_KA_PRODI = config.default_ka_prodi or ""

    save_settings_to_env({
        "BRAND_CAMPUS_NAME": config.brand_campus_name,
        "BRAND_CAMPUS_LOGO_URL": config.brand_campus_logo_url or "",
        "DEFAULT_KOORDINATOR_PENGEMBANG": config.default_koordinator_pengembang or "",
        "DEFAULT_KOORDINATOR_RMK": config.default_koordinator_rmk or "",
        "DEFAULT_KA_PRODI": config.default_ka_prodi or "",
    })
    return {
        "success": True,
        "brand_campus_name": settings.BRAND_CAMPUS_NAME,
        "brand_campus_logo_url": settings.BRAND_CAMPUS_LOGO_URL,
        "default_koordinator_pengembang": settings.DEFAULT_KOORDINATOR_PENGEMBANG,
        "default_koordinator_rmk": settings.DEFAULT_KOORDINATOR_RMK,
        "default_ka_prodi": settings.DEFAULT_KA_PRODI,
    }

