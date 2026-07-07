from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
from app.services.ollama_service import ai_service as ollama_service
from app.core.config import settings

router = APIRouter(prefix="/ollama", tags=["Ollama"])


class OllamaConfig(BaseModel):
    base_url: str
    model: str


@router.get("/status")
async def check_ollama():
    available = await ollama_service.check_available()
    return {"available": available}


@router.get("/models")
async def list_models():
    try:
        models = await ollama_service.list_models()
        return {"models": models}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/configure")
async def configure_ollama(config: OllamaConfig):
    """Update Ollama host & model di runtime (tanpa restart)."""
    base_url = config.base_url.rstrip("/")
    ollama_service.base_url = base_url
    ollama_service.model = config.model
    # Recreate client with new URL
    ollama_service.client = httpx.AsyncClient(
        base_url=base_url,
        timeout=settings.OLLAMA_TIMEOUT,
    )
    available = await ollama_service.check_available()
    return {"success": True, "available": available, "base_url": base_url, "model": config.model}