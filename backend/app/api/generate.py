from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified
from app.core.database import get_db
from app.models import RPS, Prodi, MataKuliah
from app.schemas import RPSGenerateRequest, BulkGenerateRequest, OBEValidationRequest, OBEValidationResponse
from app.services.rps_generator import rps_generator_service
from sqlalchemy import select
import json

router = APIRouter(prefix="/generate", tags=["AI Generation"])


# ── Shared helper: run SDGs analysis and save results ─────────────────────────
async def _analyze_and_save_sdgs(rps: RPS, mk: MataKuliah, db: AsyncSession) -> list:
    """Run SDGs analysis for an RPS and persist the result. Returns list of SDG integers."""
    try:
        from app.services.ollama_service import ai_service
        from app.prompts.rps_prompts import SDGS_ANALYSIS_SYSTEM_PROMPT, SDGS_ANALYSIS_PROMPT

        nama_mk = mk.nama if mk else (rps.identitas.get("nama_mata_kuliah") if rps.identitas else "Mata Kuliah")
        deskripsi = rps.deskripsi_mata_kuliah or (mk.deskripsi if mk else "")
        cpmk_list = rps.cpmk or []
        cpmk_str = ""
        for idx, c in enumerate(cpmk_list):
            cpmk_str += f"- CPMK {c.get('kode', f'0{idx+1}')}: {c.get('deskripsi', '')}\n"
            if c.get("cpl_prodi"):
                cpmk_str += f"  CPL: {', '.join(c.get('cpl_prodi'))}\n"

        prompt = SDGS_ANALYSIS_PROMPT.format(
            nama_mata_kuliah=nama_mk,
            deskripsi_mata_kuliah=deskripsi or "Tidak ada deskripsi",
            capaian_pembelajaran=cpmk_str or "Tidak ada capaian pembelajaran"
        )

        response_text = await ai_service.generate(
            prompt=prompt,
            system_prompt=SDGS_ANALYSIS_SYSTEM_PROMPT,
            temperature=0.3,
            format="json"
        )

        cleaned = response_text.strip()
        if cleaned.startswith("```json"): cleaned = cleaned[7:]
        if cleaned.endswith("```"): cleaned = cleaned[:-3]
        data = json.loads(cleaned.strip())

        sdgs = list(set([int(x) for x in data.get("sdgs", []) if str(x).isdigit() and 1 <= int(x) <= 17]))
        rps.sdgs = sdgs
        if mk and not mk.sdgs:
            mk.sdgs = sdgs
        await db.commit()
        return sdgs
    except Exception as e:
        print(f"[rps-one] SDGs analysis failed for RPS {rps.id}: {e}")
        return rps.sdgs or []


# ── Shared helper: run Bloom analysis and save results ─────────────────────────
async def _analyze_and_save_bloom(rps: RPS, db: AsyncSession) -> bool:
    """Run Bloom taxonomy analysis for an RPS and persist corrections. Returns True if changed."""
    try:
        from app.services.ollama_service import ai_service
        from app.prompts.rps_prompts import BLOOM_ANALYSIS_SYSTEM_PROMPT, BLOOM_ANALYSIS_PROMPT

        cpmk_list = rps.cpmk or []
        sub_cpmk_list = rps.sub_cpmk or []
        if not cpmk_list:
            return False

        cpmk_data_str = json.dumps([
            {"kode": c.get("kode", ""), "deskripsi": c.get("deskripsi", ""), "taksonomi_bloom": c.get("taksonomi_bloom", "")}
            for c in cpmk_list
        ], indent=2)
        sub_cpmk_data_str = json.dumps([
            {"kode": s.get("kode", ""), "cpmk_kode": s.get("cpmk_kode", ""), "deskripsi": s.get("deskripsi", "")}
            for s in sub_cpmk_list
        ], indent=2)

        prompt = BLOOM_ANALYSIS_PROMPT.format(cpmk_data=cpmk_data_str, sub_cpmk_data=sub_cpmk_data_str)
        response_text = await ai_service.generate(
            prompt=prompt,
            system_prompt=BLOOM_ANALYSIS_SYSTEM_PROMPT,
            temperature=0.2,
            format="json"
        )

        cleaned = response_text.strip()
        if cleaned.startswith("```json"): cleaned = cleaned[7:]
        if cleaned.endswith("```"): cleaned = cleaned[:-3]
        data = json.loads(cleaned.strip())

        corrected_cpmk = data.get("cpmk", [])
        corrected_sub_cpmk = data.get("sub_cpmk", [])
        changed = False

        updated_cpmk = []
        for idx, c in enumerate(cpmk_list):
            code = c.get("kode")
            corrected_item = next((x for x in corrected_cpmk if x.get("kode") == code), None)
            if not corrected_item and idx < len(corrected_cpmk):
                corrected_item = corrected_cpmk[idx]
            if corrected_item:
                new_bloom = corrected_item.get("taksonomi_bloom")
                new_desc = corrected_item.get("deskripsi")
                if new_bloom and new_bloom in ("C1", "C2", "C3", "C4", "C5", "C6"):
                    if c.get("taksonomi_bloom") != new_bloom:
                        c["taksonomi_bloom"] = new_bloom; changed = True
                if new_desc and new_desc.strip() and c.get("deskripsi") != new_desc:
                    c["deskripsi"] = new_desc.strip(); changed = True
            updated_cpmk.append(c)

        updated_sub_cpmk = []
        for idx, s in enumerate(sub_cpmk_list):
            code = s.get("kode")
            corrected_item = next((x for x in corrected_sub_cpmk if x.get("kode") == code), None)
            if not corrected_item and idx < len(corrected_sub_cpmk):
                corrected_item = corrected_sub_cpmk[idx]
            if corrected_item:
                new_desc = corrected_item.get("deskripsi")
                if new_desc and new_desc.strip() and s.get("deskripsi") != new_desc:
                    s["deskripsi"] = new_desc.strip(); changed = True
            updated_sub_cpmk.append(s)

        if changed:
            rps.cpmk = updated_cpmk
            flag_modified(rps, "cpmk")
            rps.sub_cpmk = updated_sub_cpmk
            flag_modified(rps, "sub_cpmk")
            await db.commit()

        return changed
    except Exception as e:
        print(f"[rps-one] Bloom analysis failed for RPS {rps.id}: {e}")
        return False


def handle_ai_error(e: Exception) -> str:
    err_msg = str(e)
    if "connect" in err_msg.lower() or "connection refused" in err_msg.lower() or "timeout" in err_msg.lower():
        return f"Koneksi ke AI Provider gagal. Silakan cek apakah server AI aktif di URL Pengaturan. Detail: {err_msg}"
    elif "404" in err_msg or "not found" in err_msg.lower():
        return f"Model AI tidak ditemukan atau tidak merespon (HTTP 404). Silakan cek nama model di Pengaturan. Detail: {err_msg}"
    return f"Gagal memproses dengan AI. Detail: {err_msg}"


@router.post("/rps", response_model=dict)
async def generate_rps(
    data: RPSGenerateRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    # Load prodi data
    prodi_result = await db.execute(select(Prodi).where(Prodi.id == data.prodi_id))
    prodi = prodi_result.scalar_one_or_none()
    if not prodi:
        raise HTTPException(status_code=404, detail="Prodi not found")
    
    mk_result = await db.execute(select(MataKuliah).where(MataKuliah.id == data.mata_kuliah_id))
    mk = mk_result.scalar_one_or_none()
    if not mk:
        raise HTTPException(status_code=404, detail="Mata kuliah not found")
    
    # Prepare course data
    mata_kuliah_data = {
        "kode": mk.kode,
        "nama": mk.nama,
        "sks": mk.sks,
        "sks_teori": mk.sks_teori,
        "sks_praktik": mk.sks_praktik,
        "deskripsi": mk.deskripsi or "",
    }
    
    # Filter CPL to only contain mapped ones for this course if available
    all_cpl = prodi.capaian_pembelajaran_lulusan or []
    course_cpl_codes = mk.cpl_prodi or []
    if course_cpl_codes:
        filtered_cpl = [c for c in all_cpl if c.get("kode") in course_cpl_codes]
        cpl_to_use = filtered_cpl if filtered_cpl else all_cpl
    else:
        cpl_to_use = all_cpl

    try:
        rps_data = await rps_generator_service.generate_complete_rps(
            visi_prodi=prodi.visi,
            misi_prodi=prodi.misi,
            cpl_prodi=cpl_to_use,
            mata_kuliah=mata_kuliah_data,
            semester=data.semester,
            tahun_akademik=data.tahun_akademik,
            additional_context=data.additional_context,
            dosen_pengampu=data.dosen_pengampu,
            ka_prodi=prodi.ka_prodi,
            koordinator_rmk=prodi.koordinator_rmk,
        )
        
        return {
            "success": True,
            "data": rps_data,
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        friendly_err = handle_ai_error(e)
        print(f"[GENERATE RPS ERROR] {friendly_err}")
        raise HTTPException(
            status_code=500,
            detail=friendly_err,
        )



@router.post("/rps-one", response_model=dict)
async def generate_and_save_one_rps(
    data: RPSGenerateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Generate + save RPS for a single mata kuliah. Designed for sequential pipeline calls from frontend."""
    prodi_result = await db.execute(select(Prodi).where(Prodi.id == data.prodi_id))
    prodi = prodi_result.scalar_one_or_none()
    if not prodi:
        raise HTTPException(status_code=404, detail="Prodi not found")

    mk_result = await db.execute(select(MataKuliah).where(MataKuliah.id == data.mata_kuliah_id))
    mk = mk_result.scalar_one_or_none()
    if not mk:
        raise HTTPException(status_code=404, detail="Mata kuliah not found")

    mata_kuliah_data = {
        "kode": mk.kode,
        "nama": mk.nama,
        "sks": mk.sks,
        "sks_teori": mk.sks_teori,
        "sks_praktik": mk.sks_praktik,
        "deskripsi": mk.deskripsi or "",
    }

    all_cpl = prodi.capaian_pembelajaran_lulusan or []
    course_cpl_codes = mk.cpl_prodi or []
    if course_cpl_codes:
        filtered_cpl = [c for c in all_cpl if c.get("kode") in course_cpl_codes]
        cpl_to_use = filtered_cpl if filtered_cpl else all_cpl
    else:
        cpl_to_use = all_cpl

    try:
        rps_data = await rps_generator_service.generate_complete_rps(
            visi_prodi=prodi.visi,
            misi_prodi=prodi.misi,
            cpl_prodi=cpl_to_use,
            mata_kuliah=mata_kuliah_data,
            semester=data.semester,
            tahun_akademik=data.tahun_akademik,
            additional_context=data.additional_context,
            dosen_pengampu=data.dosen_pengampu,
            ka_prodi=prodi.ka_prodi,
            koordinator_rmk=prodi.koordinator_rmk,
        )

        rps = RPS(
            kode=f"RPS-{mk.kode}-{mk.semester}",
            mata_kuliah_id=mk.id,
            prodi_id=prodi.id,
            semester=data.semester,
            tahun_akademik=data.tahun_akademik,
            dosen_pengampu=data.dosen_pengampu or [],
            identitas=rps_data.get("identitas"),
            deskripsi_mata_kuliah=rps_data.get("deskripsi_mata_kuliah") or "",
            bahan_kajian=rps_data.get("bahan_kajian") or [],
            cpmk=rps_data.get("cpmk", []),
            sub_cpmk=rps_data.get("sub_cpmk", []),
            rencana_pembelajaran=rps_data.get("rencana_pembelajaran", []),
            metode_pembelajaran=rps_data.get("metode_pembelajaran", []),
            media_pembelajaran=rps_data.get("media_pembelajaran", []),
            penilaian=rps_data.get("penilaian", []),
            referensi=rps_data.get("referensi", []),
            sdgs=rps_data.get("sdgs") or mk.sdgs or [],
            status="draft",
        )
        db.add(rps)
        await db.commit()
        await db.refresh(rps)

        # ── Auto-run SDGs + Bloom analysis immediately after save ─────────────
        sdgs = await _analyze_and_save_sdgs(rps, mk, db)
        bloom_changed = await _analyze_and_save_bloom(rps, db)
        await db.refresh(rps)

        return {
            "success": True,
            "rps_id": rps.id,
            "mk": mk.nama,
            "kode": mk.kode,
            "sdgs": sdgs,
            "bloom_updated": bloom_changed,
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=handle_ai_error(e))


@router.post("/bulk-rps", response_model=dict)
async def bulk_generate_rps(
    data: BulkGenerateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Generate RPS for all Mata Kuliah in a Prodi."""
    prodi_result = await db.execute(select(Prodi).where(Prodi.id == data.prodi_id))
    prodi = prodi_result.scalar_one_or_none()
    if not prodi:
        raise HTTPException(status_code=404, detail="Prodi not found")

    # Get all mata kuliah for this prodi
    mk_query = select(MataKuliah).where(MataKuliah.prodi_id == data.prodi_id)
    if data.semester:
        mk_query = mk_query.where(MataKuliah.semester == data.semester)
    mk_result = await db.execute(mk_query)
    mata_kuliah_list = mk_result.scalars().all()

    if not mata_kuliah_list:
        raise HTTPException(status_code=404, detail="Tidak ada mata kuliah ditemukan")

    results = []
    errors = []

    for mk in mata_kuliah_list:
        if await request.is_disconnected():
            print(f"[BULK GENERATE] Client disconnected. Stopping generation at mata kuliah: {mk.nama}")
            break
        try:
            mk_data = {
                "kode": mk.kode,
                "nama": mk.nama,
                "sks": mk.sks,
                "sks_teori": mk.sks_teori,
                "sks_praktik": mk.sks_praktik,
                "deskripsi": mk.deskripsi or "",
            }
            # Filter CPL to only contain mapped ones for this course if available
            all_cpl = prodi.capaian_pembelajaran_lulusan or []
            course_cpl_codes = mk.cpl_prodi or []
            if course_cpl_codes:
                filtered_cpl = [c for c in all_cpl if c.get("kode") in course_cpl_codes]
                cpl_to_use = filtered_cpl if filtered_cpl else all_cpl
            else:
                cpl_to_use = all_cpl

            rps_data = await rps_generator_service.generate_complete_rps(
                visi_prodi=prodi.visi,
                misi_prodi=prodi.misi,
                cpl_prodi=cpl_to_use,
                mata_kuliah=mk_data,
                semester=mk.semester,
                tahun_akademik=data.tahun_akademik,
                additional_context=data.additional_context,
                ka_prodi=prodi.ka_prodi,
                koordinator_rmk=prodi.koordinator_rmk,
            )
            
            # Save to database
            rps = RPS(
                kode=f"RPS-{mk.kode}-{mk.semester}",
                mata_kuliah_id=mk.id,
                prodi_id=prodi.id,
                semester=mk.semester,
                tahun_akademik=data.tahun_akademik,
                dosen_pengampu=data.dosen_pengampu or [],
                identitas=rps_data.get("identitas"),
                deskripsi_mata_kuliah=rps_data.get("deskripsi_mata_kuliah") or "",
                bahan_kajian=rps_data.get("bahan_kajian") or [],
                cpmk=rps_data.get("cpmk", []),
                sub_cpmk=rps_data.get("sub_cpmk", []),
                rencana_pembelajaran=rps_data.get("rencana_pembelajaran", []),
                metode_pembelajaran=rps_data.get("metode_pembelajaran", []),
                media_pembelajaran=rps_data.get("media_pembelajaran", []),
                penilaian=rps_data.get("penilaian", []),
                referensi=rps_data.get("referensi", []),
                sdgs=rps_data.get("sdgs") or mk.sdgs or [],
                status="draft",
            )
            db.add(rps)
            await db.commit()
            results.append({"mk": mk.nama, "kode": mk.kode, "rps_id": rps.id})
        except Exception as e:
            errors.append({"mk": mk.nama, "error": str(e)})

    return {
        "success": True,
        "total": len(mata_kuliah_list),
        "created": len(results),
        "errors": len(errors),
        "results": results,
        "error_detail": errors,
    }


@router.post("/cpmk", response_model=dict)
async def generate_cpmk(
    data: dict,
    db: AsyncSession = Depends(get_db),
):
    prodi_id = data.get("prodi_id")
    mk_id = data.get("mata_kuliah_id")
    
    prodi_result = await db.execute(select(Prodi).where(Prodi.id == prodi_id))
    prodi = prodi_result.scalar_one_or_none()
    if not prodi:
        raise HTTPException(status_code=404, detail="Prodi not found")
    
    mk_result = await db.execute(select(MataKuliah).where(MataKuliah.id == mk_id))
    mk = mk_result.scalar_one_or_none()
    if not mk:
        raise HTTPException(status_code=404, detail="Mata kuliah not found")
    
    try:
        cpmk = await rps_generator_service.generate_cpmk(
            visi_prodi=prodi.visi,
            misi_prodi=prodi.misi,
            cpl_prodi=prodi.capaian_pembelajaran_lulusan or [],
            nama_mk=mk.nama,
            deskripsi_mk=mk.deskripsi or "",
        )
        return {"success": True, "data": cpmk}
    except Exception as e:
        raise HTTPException(status_code=500, detail=handle_ai_error(e))


@router.post("/sub-cpmk", response_model=dict)
async def generate_sub_cpmk(data: dict):
    try:
        result = await rps_generator_service.generate_sub_cpmk(
            cpmk_list=data.get("cpmk", []),
            nama_mk=data.get("nama_mk", ""),
        )
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=handle_ai_error(e))


@router.post("/rencana-mingguan", response_model=dict)
async def generate_rencana_mingguan(data: dict):
    try:
        result = await rps_generator_service.generate_rencana_mingguan(
            cpmk=data.get("cpmk", []),
            sub_cpmk=data.get("sub_cpmk", []),
            sks=data.get("sks", 3),
        )
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=handle_ai_error(e))


@router.post("/penilaian", response_model=dict)
async def generate_penilaian(data: dict):
    try:
        result = await rps_generator_service.generate_penilaian(
            cpmk=data.get("cpmk", []),
            sub_cpmk=data.get("sub_cpmk", []),
        )
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=handle_ai_error(e))


@router.post("/validate-obe", response_model=OBEValidationResponse)
async def validate_obe(
    data: OBEValidationRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(RPS).where(RPS.id == data.rps_id))
    rps = result.scalar_one_or_none()
    if not rps:
        raise HTTPException(status_code=404, detail="RPS not found")
    
    rps_data = {
        "identitas": rps.identitas,
        "cpmk": rps.cpmk,
        "sub_cpmk": rps.sub_cpmk,
        "rencana_pembelajaran": rps.rencana_pembelajaran,
        "metode_pembelajaran": rps.metode_pembelajaran,
        "media_pembelajaran": rps.media_pembelajaran,
        "penilaian": rps.penilaian,
        "referensi": rps.referensi,
    }
    
    try:
        validation = await rps_generator_service.validate_obe(rps_data)
        
        # Save validation result
        rps.obe_validated = True
        rps.obe_validation_result = validation
        rps.obe_score = validation.get("score", 0)
        await db.commit()
        
        return OBEValidationResponse(
            rps_id=rps.id,
            validated=validation.get("validated", False),
            score=validation.get("score", 0),
            issues=validation.get("issues", []),
            suggestions=validation.get("suggestions", []),
            details=validation.get("details", {}),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=handle_ai_error(e))


@router.post("/review", response_model=dict)
async def review_rps(data: dict):
    rps_data = data.get("rps_data", {})
    feedback = data.get("feedback", "")
    try:
        result = await rps_generator_service.review_and_improve(rps_data, feedback)
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=handle_ai_error(e))