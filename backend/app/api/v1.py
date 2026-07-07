from fastapi import APIRouter

router = APIRouter(prefix="/api/v1")


from app.api.prodi import router as prodi_router
from app.api.mata_kuliah import router as mk_router
from app.api.rps import router as rps_router
from app.api.generate import router as generate_router
from app.api.export import router as export_router
from app.api.ollama import router as ollama_router
from app.api.upload import router as upload_router
from app.api.auth import router as auth_router

router.include_router(prodi_router)
router.include_router(mk_router)
router.include_router(rps_router)
router.include_router(generate_router)
router.include_router(export_router)
router.include_router(ollama_router)
router.include_router(upload_router)
router.include_router(auth_router)