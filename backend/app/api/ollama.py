from fastapi import APIRouter, HTTPException
from app.services.ollama_service import ollama_service

router = APIRouter(prefix="/ollama", tags=["Ollama"])


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