from fastapi import APIRouter, Depends, HTTPException, Header, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional, List, Dict, Any, Union
from app.core.database import get_db
from app.core.config import settings
from app.models import RPS, MataKuliah, Prodi
from app.services.rps_generator import rps_generator_service
import uuid

router = APIRouter(prefix="/integration/siakad", tags=["SIAKAD Integration"])


def generate_rps_kode():
    return f"RPS-{uuid.uuid4().hex[:8].upper()}"


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


def _format_rps_response(rps: RPS, mk: MataKuliah):
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

    return _format_rps_response(rps, mk)


class AutoGenerateFromSiakadRequest(BaseModel):
    kode_mk: str
    nama_mk: str
    sks: Optional[int] = 3
    semester: Optional[int] = 1
    tahun_akademik: Optional[str] = "2025/2026 Genap"
    prodi_nama: Optional[str] = "Program Studi"
    prodi_kode: Optional[str] = ""
    dosen_pengampu: Optional[Union[List[str], List[Dict[str, Any]], str]] = []
    cpl_list: Optional[List[Union[str, Dict[str, Any]]]] = None
    force_regenerate: Optional[bool] = False


@router.post("/auto-generate")
async def auto_generate_rps_from_siakad(
    req: AutoGenerateFromSiakadRequest,
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(verify_siakad_api_key)
):
    """
    Whole-shebang 1-click endpoint from SIAKAD:
    1. Finds or auto-creates Prodi with Visi/Misi & CPL.
    2. Finds or auto-creates MataKuliah.
    3. Generates complete 16-week OBE RPS (CPMK, Sub-CPMK, Bloom, SDGs, Rubrik Penilaian).
    4. Saves to database and returns full published RPS.
    """
    clean_kode_mk = req.kode_mk.strip()
    clean_nama_mk = req.nama_mk.strip()
    clean_prodi_nama = req.prodi_nama.strip() if req.prodi_nama else "Program Studi"

    # 1. Find or Auto-Create Prodi
    prodi_res = await db.execute(
        select(Prodi).where(
            (func.lower(Prodi.nama) == clean_prodi_nama.lower()) |
            (func.lower(Prodi.kode) == (req.prodi_kode or "").strip().lower())
        )
    )
    prodi = prodi_res.scalars().first()

    if not prodi:
        cpl_defaults = req.cpl_list or [
            {"kode": "CPL-01", "deskripsi": "Menunjukkan ketakwaan kepada Tuhan YME, etika profesi, dan integritas akademik.", "kategori": "Sikap"},
            {"kode": "CPL-02", "deskripsi": f"Menguasai konsep teoritis, prinsip keilmuan, dan metode pemecahan masalah dalam bidang {clean_prodi_nama}.", "kategori": "Pengetahuan"},
            {"kode": "CPL-03", "deskripsi": "Mampu merancang, menganalisis, dan memvalidasi solusi inovatif berbasis teknologi.", "kategori": "Keterampilan Khusus"},
            {"kode": "CPL-04", "deskripsi": "Mampu berkomunikasi efektif, bekerjasama dalam tim multidisiplin, dan mandiri.", "kategori": "Keterampilan Umum"}
        ]
        prodi = Prodi(
            kode=req.prodi_kode or (clean_prodi_nama[:4].upper() if clean_prodi_nama else "PRODI"),
            nama=clean_prodi_nama,
            jenjang="S1",
            visi=f"Menjadi Program Studi {clean_prodi_nama} yang unggul, berdaya saing global, dan berintegritas tinggi.",
            misi=[
                f"Menyelenggarakan proses pembelajaran Outcome-Based Education (OBE) bermutu tinggi pada bidang {clean_prodi_nama}.",
                "Mengembangkan penelitian terapan dan inovasi iptek yang bermanfaat bagi masyarakat dan industri.",
                "Melaksanakan pengabdian kepada masyarakat berbasis kompetensi keilmuan."
            ],
            cpl=cpl_defaults
        )
        db.add(prodi)
        await db.flush()

    # 2. Find or Auto-Create MataKuliah
    mk_res = await db.execute(
        select(MataKuliah).where(func.lower(MataKuliah.kode_mk) == clean_kode_mk.lower())
    )
    mk = mk_res.scalars().first()

    if not mk:
        mk = MataKuliah(
            kode_mk=clean_kode_mk,
            nama_mk=clean_nama_mk,
            sks=req.sks or 3,
            semester=req.semester or 1,
            prodi_id=prodi.id,
            jenis="Wajib",
            deskripsi=f"Mata kuliah {clean_nama_mk} ({clean_kode_mk}) diselenggarakan dengan kerangka Outcome-Based Education (OBE) mencakup penguasaan teori, studi kasus terapan, dan proyek komprehensif."
        )
        db.add(mk)
        await db.flush()

    # 3. Check existing RPS
    rps_res = await db.execute(
        select(RPS)
        .where(RPS.mata_kuliah_id == mk.id)
        .order_by(RPS.updated_at.desc(), RPS.id.desc())
    )
    rps = rps_res.scalars().first()

    has_full_materials = rps and len(rps.rencana_pembelajaran or []) >= 14

    # If already exists with full materials and not force_regenerate, return existing
    if rps and has_full_materials and not req.force_regenerate:
        return _format_rps_response(rps, mk)

    # 4. Generate Full RPS using AI / Generator Service
    prodi_data = {
        "id": prodi.id,
        "nama": prodi.nama,
        "kode": prodi.kode,
        "visi": prodi.visi,
        "misi": prodi.misi,
        "cpl": prodi.cpl or []
    }
    mk_data = {
        "id": mk.id,
        "kode": mk.kode_mk,
        "nama": mk.nama_mk,
        "sks": mk.sks,
        "deskripsi": mk.deskripsi
    }

    try:
        generated_data = await rps_generator_service.generate_full_rps(
            mata_kuliah=mk_data,
            prodi_data=prodi_data,
            semester=req.semester or mk.semester or 1,
            tahun_akademik=req.tahun_akademik or "2025/2026 Genap",
            dosen_pengampu=req.dosen_pengampu or [],
            cpl_prodi=[c.get("kode", "") + ": " + c.get("deskripsi", "") if isinstance(c, dict) else str(c) for c in (prodi.cpl or [])]
        )
    except Exception as gen_err:
        print(f"[WholeShebang Auto-Generate] AI error, using fallback template: {gen_err}")
        # Build robust structured fallback if AI times out
        generated_data = {
            "identitas": {
                "nama_mata_kuliah": clean_nama_mk,
                "kode_mata_kuliah": clean_kode_mk,
                "sks": req.sks or 3,
                "semester": req.semester or 1,
                "tahun_akademik": req.tahun_akademik or "2025/2026 Genap",
                "prodi": clean_prodi_nama
            },
            "deskripsi_mata_kuliah": f"Mata kuliah {clean_nama_mk} membekali mahasiswa dengan keahlian komprehensif, pemecahan masalah, dan portofolio berbasis OBE.",
            "bahan_kajian": ["Konsep Fundamental", "Metodologi & Analisis", "Implementasi Praktis", "Evaluasi & Studi Kasus"],
            "cpmk": [
                {"kode": "CPMK-1", "deskripsi": f"Mampu memahami dan menjelaskan konsep fundamental {clean_nama_mk}.", "bobot": 20, "taksonomi_bloom": "C2"},
                {"kode": "CPMK-2", "deskripsi": f"Mampu menganalisis masalah dan menerapkan metode terstruktur dalam {clean_nama_mk}.", "bobot": 30, "taksonomi_bloom": "C4"},
                {"kode": "CPMK-3", "deskripsi": "Mampu merancang dan mengembangkan proyek terintegrasi.", "bobot": 35, "taksonomi_bloom": "C6"},
                {"kode": "CPMK-4", "deskripsi": "Mampu menunjukkan sikap profesional dan kerjasama tim.", "bobot": 15, "taksonomi_bloom": "A3"}
            ],
            "sub_cpmk": [
                {"kode": "Sub-CPMK-1", "cpmk_kode": "CPMK-1", "deskripsi": "Mengidentifikasi landasan teori dan prinsip dasar", "indikator": ["Ketepatan pemahaman"]},
                {"kode": "Sub-CPMK-2", "cpmk_kode": "CPMK-2", "deskripsi": "Menganalisis skenario studi kasus", "indikator": ["Ketepatan analisis"]},
                {"kode": "Sub-CPMK-3", "cpmk_kode": "CPMK-3", "deskripsi": "Mengembangkan luaran proyek akhir", "indikator": ["Kualitas karya"]},
                {"kode": "Sub-CPMK-4", "cpmk_kode": "CPMK-4", "deskripsi": "Mempresentasikan hasil evaluasi secara efektif", "indikator": ["Komunikasi"]}
            ],
            "rencana_pembelajaran": [
                {"minggu": i, "sub_cpmk": f"Penguasaan materi topik minggu ke-{i}", "materi_pembelajaran": f"Materi Pokok Pertemuan {i}: Kajian Terapan {clean_nama_mk}", "bentuk_pembelajaran": "Kuliah Interaktif & Diskusi", "alokasi_waktu": f"{req.sks or 3}x50 Menit", "pengalaman_belajar": "Mempelajari modul dan berdiskusi", "kriteria_penilaian": "Keaktifan & Tugas", "bobot_penilaian": 5}
                for i in range(1, 17)
            ],
            "penilaian": [
                {"komponen": "Kehadiran & Partisipasi", "bobot": 10, "teknik": "Observasi", "kriteria": "Presensi & Keaktifan"},
                {"komponen": "Tugas Terstruktur", "bobot": 20, "teknik": "Penugasan", "kriteria": "Rubrik Tugas"},
                {"komponen": "Project-Based Learning", "bobot": 30, "teknik": "Unjuk Kerja", "kriteria": "Rubrik Proyek"},
                {"komponen": "UTS", "bobot": 20, "teknik": "Ujian Tertulis/CBT", "kriteria": "Tes Objektif"},
                {"komponen": "UAS", "bobot": 20, "teknik": "Ujian Akhir/Portofolio", "kriteria": "Rubrik UAS"}
            ],
            "referensi": {"utama": [f"Buku Ajar Utama: {clean_nama_mk} (2025)"], "pendukung": ["Jurnal Ilmiah & Studi Kasus Terkini"]},
            "sdgs": [4, 8, 9]
        }

    # Format dosen pengampu into list of dicts
    dosen_list_formatted = []
    if req.dosen_pengampu:
        if isinstance(req.dosen_pengampu, list):
            for d in req.dosen_pengampu:
                if isinstance(d, dict):
                    dosen_list_formatted.append(d)
                elif isinstance(d, str) and d.strip():
                    dosen_list_formatted.append({"nama": d.strip()})
        elif isinstance(req.dosen_pengampu, str) and req.dosen_pengampu.strip():
            dosen_list_formatted.append({"nama": req.dosen_pengampu.strip()})

    # 5. Save/Update RPS in Database
    if not rps:
        rps = RPS(
            kode=generate_rps_kode(),
            mata_kuliah_id=mk.id,
            prodi_id=prodi.id,
            semester=req.semester or mk.semester or 1,
            tahun_akademik=req.tahun_akademik or "2025/2026 Genap",
            dosen_pengampu=dosen_list_formatted,
            status="published"
        )
        db.add(rps)

    rps.identitas = generated_data.get("identitas")
    rps.deskripsi_mata_kuliah = generated_data.get("deskripsi_mata_kuliah") or ""
    rps.bahan_kajian = generated_data.get("bahan_kajian") or []
    rps.cpmk = generated_data.get("cpmk") or []
    rps.sub_cpmk = generated_data.get("sub_cpmk") or []
    rps.rencana_pembelajaran = generated_data.get("rencana_pembelajaran") or []
    rps.media_pembelajaran = generated_data.get("media_pembelajaran") or {}
    rps.penilaian = generated_data.get("penilaian") or []
    rps.referensi = generated_data.get("referensi") or {}
    rps.sdgs = generated_data.get("sdgs") or [4, 8, 9]
    rps.status = "published"
    if dosen_list_formatted:
        rps.dosen_pengampu = dosen_list_formatted

    await db.commit()
    await db.refresh(rps)

    return _format_rps_response(rps, mk)
