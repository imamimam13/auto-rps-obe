from fastapi import APIRouter, Depends, HTTPException, Header, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional, List, Dict, Any
from app.core.database import get_db
from app.core.config import settings
from app.models import RPS, MataKuliah, Prodi

router = APIRouter(prefix="/integration/siakad", tags=["SIAKAD Integration"])


async def verify_siakad_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    api_key: Optional[str] = Query(None),
):
    provided_key = x_api_key or api_key
    expected_key = getattr(settings, "SIAKAD_API_KEY", "rps-obe-secret-key-2026")
    
    if not provided_key or provided_key != expected_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing SIAKAD API Key (Use header 'X-API-Key' or '?api_key=...')"
        )
    return provided_key


@router.get("/health")
async def health_check(_key: str = Depends(verify_siakad_api_key)):
    """Health check for SIAKAD integration."""
    return {
        "status": "connected",
        "service": "Auto RPS OBE AI",
        "campus": settings.BRAND_CAMPUS_NAME,
        "api_version": settings.APP_VERSION,
    }


@router.get("/rps/{kode_mk}")
async def get_rps_for_siakad(
    kode_mk: str,
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(verify_siakad_api_key)
):
    """
    Get full structured RPS data & URLs for a course by its kode_mk.
    Used by SIAKAD to embed or render RPS inside course & schedule pages.
    """
    cleaned_code = kode_mk.strip()
    
    # 1. Find MataKuliah
    mk_result = await db.execute(
        select(MataKuliah).where(func.lower(MataKuliah.kode_mk) == cleaned_code.lower())
    )
    mk = mk_result.scalar_one_or_none()
    if not mk:
        mk_res2 = await db.execute(
            select(MataKuliah).where(func.lower(MataKuliah.nama_mk) == cleaned_code.lower())
        )
        mk = mk_res2.scalar_one_or_none()
        
    if not mk:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mata kuliah dengan kode '{cleaned_code}' belum terdaftar di Auto RPS OBE."
        )

    # 2. Find Latest Published or Available RPS
    rps_result = await db.execute(
        select(RPS)
        .where(RPS.mata_kuliah_id == mk.id)
        .order_by(
            RPS.status == "published",
            RPS.updated_at.desc(),
            RPS.id.desc()
        )
    )
    rps = rps_result.scalars().first()
    
    if not rps:
        return {
            "status": "not_found",
            "has_rps": False,
            "message": f"Mata kuliah '{mk.nama_mk}' ({mk.kode_mk}) ditemukan, tetapi RPS belum dibuat.",
            "mata_kuliah": {
                "id": mk.id,
                "kode_mk": mk.kode_mk,
                "nama_mk": mk.nama_mk,
                "sks": mk.sks,
                "semester": mk.semester,
            },
            "create_rps_url": f"/rps/generate/{mk.id}"
        }

    rencana = rps.rencana_pembelajaran or []
    has_full_materials = len(rencana) >= 14

    return {
        "status": "success",
        "has_rps": True,
        "rps_id": rps.id,
        "kode_rps": rps.kode,
        "rps_status": rps.status,
        "has_full_materials": has_full_materials,
        "total_meetings": len(rencana),
        "mata_kuliah": {
            "id": mk.id,
            "kode_mk": mk.kode_mk,
            "nama_mk": mk.nama_mk,
            "sks": mk.sks,
            "semester": rps.semester or mk.semester,
            "tahun_akademik": rps.tahun_akademik,
            "dosen_pengampu": rps.dosen_pengampu or [],
        },
        "obe_summary": {
            "cpmk_count": len(rps.cpmk or []),
            "sub_cpmk_count": len(rps.sub_cpmk or []),
            "sdgs": rps.sdgs or [],
            "cpmk_list": rps.cpmk or [],
            "penilaian": rps.penilaian or [],
        },
        "rencana_pembelajaran": rencana,
        "urls": {
            "preview_url": f"/rps-preview/{rps.id}",
            "preview_by_code_url": f"/rps-preview/by-mk?kode={mk.kode_mk}",
            "pdf_export_url": f"/api/v1/export/{rps.id}?export_format=pdf",
            "docx_export_url": f"/api/v1/export/{rps.id}?export_format=docx",
            "edit_rps_url": f"/rps/{rps.id}"
        }
    }
