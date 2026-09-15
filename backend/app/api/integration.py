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
    cpmk_list = rps.cpmk or []
    penilaian_list = rps.penilaian or []

    # Map rencana_pembelajaran into normalized mingguan format for SIAKAD
    mingguan = []
    for item in rencana:
        if isinstance(item, dict):
            mingguan.append({
                "minggu": item.get("minggu") or item.get("pertemuan") or len(mingguan) + 1,
                "sub_cpmk": item.get("sub_cpmk") or item.get("kemampuan_akhir") or "",
                "materi": item.get("materi_pembelajaran") or item.get("bahan_kajian") or item.get("materi") or "",
                "bentuk_pembelajaran": item.get("bentuk_pembelajaran") or item.get("metode_pembelajaran") or "Kuliah Interaktif",
                "alokasi_waktu": item.get("alokasi_waktu") or f"{mk.sks or 3}x50 Menit",
                "pengalaman_belajar": item.get("pengalaman_belajar") or "",
                "kriteria_penilaian": item.get("kriteria_penilaian") or item.get("indikator") or item.get("teknik_penilaian") or "",
                "bobot_nilai": item.get("bobot_penilaian") or item.get("bobot") or item.get("bobot_nilai") or 5,
                "is_uts": item.get("is_uts") or (item.get("minggu") == 8 or item.get("pertemuan") == 8),
                "is_uas": item.get("is_uas") or (item.get("minggu") == 16 or item.get("pertemuan") == 16),
                "cpmk": item.get("cpmk") or item.get("cpmk_kode") or ""
            })

    return {
        "status": "success",
        "has_rps": True,
        "rps_id": rps.id,
        "kode_rps": rps.kode,
        "rps_status": rps.status,
        "has_full_materials": has_full_materials,
        "total_meetings": len(rencana),
        "kode_mk": mk.kode_mk,
        "nama_mk": mk.nama_mk,
        "sks": mk.sks,
        "semester": rps.semester or mk.semester,
        "tahun_akademik": rps.tahun_akademik,
        "deskripsi": rps.deskripsi_mata_kuliah or "",
        "cpmk": cpmk_list,
        "bobot_penilaian": penilaian_list,
        "mingguan": mingguan if mingguan else rencana,
        "rencana_pembelajaran": rencana,
        "sdgs": rps.sdgs or [],
        "referensi": rps.referensi or [],
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
            "cpmk_count": len(cpmk_list),
            "sub_cpmk_count": len(rps.sub_cpmk or []),
            "sdgs": rps.sdgs or [],
            "cpmk_list": cpmk_list,
            "penilaian": penilaian_list,
        },
        "urls": {
            "preview_url": f"/rps-preview/{rps.id}",
            "preview_by_code_url": f"/rps-preview/by-mk?kode={mk.kode_mk}",
            "pdf_export_url": f"/api/v1/export/{rps.id}?export_format=pdf",
            "docx_export_url": f"/api/v1/export/{rps.id}?export_format=docx",
            "edit_rps_url": f"/rps/{rps.id}"
        }
    }
