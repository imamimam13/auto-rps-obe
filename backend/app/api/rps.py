from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified
from typing import List, Optional, Dict, Any, Union
from app.core.database import get_db
from app.models import RPS, Prodi, MataKuliah
from app.schemas import (
    RPSCreate, RPSUpdate, RPSResponse,
    RPSCopyRequest, RPSBulkCopyRequest, RPSCopySelectedRequest,
    JadwalItemExtracted, JadwalSyncRequest, JadwalSyncResponse,
    PaginatedResponse,
)
from sqlalchemy import select, func, update
import uuid
import copy
import zipfile
import io
import xml.etree.ElementTree as ET
import csv
import re
from datetime import datetime

router = APIRouter(prefix="/rps", tags=["RPS"])


def generate_rps_kode():
    return f"RPS-{uuid.uuid4().hex[:8].upper()}"


@router.get("/", response_model=PaginatedResponse)
async def list_rps(
    prodi_id: int = None,
    mata_kuliah_id: int = None,
    semester: int = None,
    status: str = None,
    tahun_akademik: str = None,
    page: int = 1,
    size: int = 100,
    limit: int = None,
    db: AsyncSession = Depends(get_db),
):
    actual_size = limit if limit is not None else size
    query = select(RPS)
    if prodi_id:
        query = query.where(RPS.prodi_id == prodi_id)
    if mata_kuliah_id:
        query = query.where(RPS.mata_kuliah_id == mata_kuliah_id)
    if semester:
        query = query.where(RPS.semester == semester)
    if status:
        query = query.where(RPS.status == status)
    if tahun_akademik:
        query = query.where(RPS.tahun_akademik == tahun_akademik)
    
    query = query.order_by(RPS.updated_at.desc(), RPS.id.desc())
    query = query.offset((page - 1) * actual_size).limit(actual_size)
    result = await db.execute(query)
    items = result.scalars().all()
    
    count_query = select(func.count(RPS.id))
    if prodi_id:
        count_query = count_query.where(RPS.prodi_id == prodi_id)
    if mata_kuliah_id:
        count_query = count_query.where(RPS.mata_kuliah_id == mata_kuliah_id)
    if semester:
        count_query = count_query.where(RPS.semester == semester)
    if status:
        count_query = count_query.where(RPS.status == status)
    if tahun_akademik:
        count_query = count_query.where(RPS.tahun_akademik == tahun_akademik)
    count_result = await db.execute(count_query)
    total = count_result.scalar()
    
    items_out = []
    for r in items:
        try:
            items_out.append(RPSResponse.model_validate(r))
        except Exception as ex:
            print(f"[list_rps] Error validating RPS id {r.id}: {ex}")
            items_out.append({
                "id": r.id,
                "kode": r.kode or "",
                "mata_kuliah_id": r.mata_kuliah_id,
                "prodi_id": r.prodi_id,
                "semester": r.semester,
                "tahun_akademik": r.tahun_akademik or "",
                "status": getattr(r.status, "value", str(r.status)) if r.status else "draft",
                "dosen_pengampu": r.dosen_pengampu or [],
                "identitas": r.identitas or {},
                "cpmk": r.cpmk or [],
                "sub_cpmk": r.sub_cpmk or [],
                "sdgs": r.sdgs or [],
                "obe_validated": r.obe_validated or False,
                "obe_score": r.obe_score,
                "created_at": r.created_at,
                "updated_at": r.updated_at,
            })

    return PaginatedResponse(
        items=items_out,
        total=total,
        page=page,
        size=actual_size,
        pages=(total + actual_size - 1) // actual_size if actual_size > 0 else 1,
    )


@router.get("/{rps_id}", response_model=RPSResponse)
async def get_rps(rps_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RPS).where(RPS.id == rps_id))
    rps = result.scalar_one_or_none()
    if not rps:
        raise HTTPException(status_code=404, detail="RPS not found")
    return rps


@router.post("/", response_model=RPSResponse, status_code=status.HTTP_201_CREATED)
async def create_rps(data: RPSCreate, db: AsyncSession = Depends(get_db)):
    # Validate prodi and mata_kuliah
    prodi = await db.execute(select(Prodi).where(Prodi.id == data.prodi_id))
    if not prodi.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Prodi not found")
    
    mk = await db.execute(select(MataKuliah).where(MataKuliah.id == data.mata_kuliah_id))
    if not mk.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Mata kuliah not found")
    
    rps = RPS(
        kode=generate_rps_kode(),
        mata_kuliah_id=data.mata_kuliah_id,
        prodi_id=data.prodi_id,
        semester=data.semester,
        tahun_akademik=data.tahun_akademik,
        dosen_pengampu=data.dosen_pengampu or [],
        identitas=data.identitas if isinstance(data.identitas, dict) else (data.identitas.model_dump() if data.identitas else None),
        deskripsi_mata_kuliah=data.deskripsi_mata_kuliah or "",
        bahan_kajian=data.bahan_kajian or [],
        cpmk=[c if isinstance(c, dict) else c.model_dump() for c in (data.cpmk or [])],
        sub_cpmk=[s if isinstance(s, dict) else s.model_dump() for s in (data.sub_cpmk or [])],
        rencana_pembelajaran=[r if isinstance(r, dict) else r.model_dump() for r in (data.rencana_pembelajaran or [])],
        metode_pembelajaran=data.metode_pembelajaran or [],
        media_pembelajaran=data.media_pembelajaran or [],
        penilaian=[p if isinstance(p, dict) else p.model_dump() for p in (data.penilaian or [])],
        referensi=data.referensi or [],
        sdgs=data.sdgs or [],
    )
    db.add(rps)
    await db.commit()
    await db.refresh(rps)
    return rps


@router.put("/{rps_id}", response_model=RPSResponse)
async def update_rps(rps_id: int, data: RPSUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RPS).where(RPS.id == rps_id))
    rps = result.scalar_one_or_none()
    if not rps:
        raise HTTPException(status_code=404, detail="RPS not found")
    
    update_data = data.model_dump(exclude_unset=True)
    
    # Handle nested JSON fields
    json_fields = ["identitas", "deskripsi_mata_kuliah", "bahan_kajian", "cpmk", "sub_cpmk", "rencana_pembelajaran", "metode_pembelajaran", "media_pembelajaran", "penilaian", "referensi", "sdgs"]
    for field in json_fields:
        if field in update_data:
            setattr(rps, field, update_data[field])
            del update_data[field]
    
    for key, val in update_data.items():
        setattr(rps, key, val)
    
    await db.commit()
    await db.refresh(rps)
    return rps


@router.delete("/{rps_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rps(rps_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RPS).where(RPS.id == rps_id))
    rps = result.scalar_one_or_none()
    if not rps:
        raise HTTPException(status_code=404, detail="RPS not found")
    await db.delete(rps)
    await db.commit()


@router.post("/{rps_id}/approve", response_model=RPSResponse)
async def approve_rps(
    rps_id: int,
    approved_by: int = 1,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(RPS).where(RPS.id == rps_id))
    rps = result.scalar_one_or_none()
    if not rps:
        raise HTTPException(status_code=404, detail="RPS not found")
    
    rps.status = "approved"
    rps.approved_at = datetime.now()
    rps.approved_by = approved_by
    await db.commit()
    await db.refresh(rps)
    return rps


@router.post("/{rps_id}/analyze-sdgs")
async def analyze_rps_sdgs(rps_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RPS).where(RPS.id == rps_id))
    rps = result.scalar_one_or_none()
    if not rps:
        raise HTTPException(status_code=404, detail="RPS not found")
        
    # Get course details
    mk_result = await db.execute(select(MataKuliah).where(MataKuliah.id == rps.mata_kuliah_id))
    mk = mk_result.scalar_one_or_none()
    
    nama_mk = mk.nama if mk else (rps.identitas.get("nama_mata_kuliah") if rps.identitas else "Mata Kuliah")
    deskripsi = rps.deskripsi_mata_kuliah or (mk.deskripsi if mk else "")
    
    # Format CPMK & CPL
    cpmk_list = rps.cpmk or []
    cpmk_str = ""
    for idx, c in enumerate(cpmk_list):
        cpmk_str += f"- CPMK {c.get('kode', f'0{idx+1}')}: {c.get('deskripsi', '')}\n"
        if c.get("cpl_prodi"):
            cpmk_str += f"  CPL: {', '.join(c.get('cpl_prodi'))}\n"
            
    from app.services.ollama_service import ai_service
    from app.prompts.rps_prompts import SDGS_ANALYSIS_SYSTEM_PROMPT, SDGS_ANALYSIS_PROMPT
    import json
    
    prompt = SDGS_ANALYSIS_PROMPT.format(
        nama_mata_kuliah=nama_mk,
        deskripsi_mata_kuliah=deskripsi or "Tidak ada deskripsi",
        capaian_pembelajaran=cpmk_str or "Tidak ada capaian pembelajaran khusus"
    )
    
    try:
        response_text = await ai_service.generate(
            prompt=prompt,
            system_prompt=SDGS_ANALYSIS_SYSTEM_PROMPT,
            temperature=0.3,
            format="json"
        )
        
        # Parse result
        # Clean potential markdown wrappers
        cleaned = response_text.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
        
        data = json.loads(cleaned)
        sdgs = data.get("sdgs", [])
        # Ensure it's list of unique integers
        sdgs = list(set([int(x) for x in sdgs if str(x).isdigit() and 1 <= int(x) <= 17]))
        
        # Save to database
        rps.sdgs = sdgs
        # Also update the Mata Kuliah if it has no SDGs yet
        if mk and not mk.sdgs:
            mk.sdgs = sdgs
            
        await db.commit()
        await db.refresh(rps)
        
        return {
            "status": "success",
            "sdgs": sdgs,
            "reasoning": data.get("reasoning", ""),
            "message": "Analisis SDGs selesai"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Gagal melakukan analisis SDGs dengan AI: {str(e)}"
        )


@router.post("/{rps_id}/analyze-bloom")
async def analyze_rps_bloom(rps_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RPS).where(RPS.id == rps_id))
    rps = result.scalar_one_or_none()
    if not rps:
        raise HTTPException(status_code=404, detail="RPS not found")
        
    cpmk_list = rps.cpmk or []
    sub_cpmk_list = rps.sub_cpmk or []
    if not cpmk_list:
        return {
            "status": "success",
            "cpmk": [],
            "sub_cpmk": [],
            "reasoning": "RPS tidak memiliki data CPMK untuk dianalisis.",
            "message": "Tidak ada CPMK"
        }
        
    # Serialize CPMKs and Sub-CPMKs for prompt
    import json
    cpmk_data_str = json.dumps([
        {"kode": c.get("kode", ""), "deskripsi": c.get("deskripsi", ""), "taksonomi_bloom": c.get("taksonomi_bloom", "")}
        for c in cpmk_list
    ], indent=2)
    
    sub_cpmk_data_str = json.dumps([
        {"kode": s.get("kode", ""), "cpmk_kode": s.get("cpmk_kode", ""), "deskripsi": s.get("deskripsi", "")}
        for s in sub_cpmk_list
    ], indent=2)
    
    from app.services.ollama_service import ai_service
    from app.prompts.rps_prompts import BLOOM_ANALYSIS_SYSTEM_PROMPT, BLOOM_ANALYSIS_PROMPT
    
    prompt = BLOOM_ANALYSIS_PROMPT.format(cpmk_data=cpmk_data_str, sub_cpmk_data=sub_cpmk_data_str)
    
    try:
        response_text = await ai_service.generate(
            prompt=prompt,
            system_prompt=BLOOM_ANALYSIS_SYSTEM_PROMPT,
            temperature=0.2,
            format="json"
        )
        
        # Clean potential markdown wrappers
        cleaned = response_text.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
        
        data = json.loads(cleaned)
        corrected_cpmk = data.get("cpmk", [])
        corrected_sub_cpmk = data.get("sub_cpmk", [])
        
        # Apply corrections to rps.cpmk
        updated_cpmk = []
        changed = False
        for idx, c in enumerate(cpmk_list):
            code = c.get("kode")
            
            # Find matching corrected item (by code or fallback to positional index)
            corrected_item = None
            for item in corrected_cpmk:
                if item.get("kode") == code:
                    corrected_item = item
                    break
            if not corrected_item and idx < len(corrected_cpmk):
                corrected_item = corrected_cpmk[idx]
                
            if corrected_item:
                new_bloom = corrected_item.get("taksonomi_bloom")
                new_desc = corrected_item.get("deskripsi")
                
                if new_bloom and new_bloom in ("C1", "C2", "C3", "C4", "C5", "C6"):
                    if c.get("taksonomi_bloom") != new_bloom:
                        c["taksonomi_bloom"] = new_bloom
                        changed = True
                if new_desc and new_desc.strip():
                    if c.get("deskripsi") != new_desc:
                        c["deskripsi"] = new_desc.strip()
                        changed = True
            updated_cpmk.append(c)
            
        # Apply corrections to rps.sub_cpmk
        updated_sub_cpmk = []
        for idx, s in enumerate(sub_cpmk_list):
            code = s.get("kode")
            
            corrected_item = None
            for item in corrected_sub_cpmk:
                if item.get("kode") == code:
                    corrected_item = item
                    break
            if not corrected_item and idx < len(corrected_sub_cpmk):
                corrected_item = corrected_sub_cpmk[idx]
                
            if corrected_item:
                new_desc = corrected_item.get("deskripsi")
                if new_desc and new_desc.strip():
                    if s.get("deskripsi") != new_desc:
                        s["deskripsi"] = new_desc.strip()
                        changed = True
            updated_sub_cpmk.append(s)
            
        if changed:
            # SQLAlchemy JSON column needs assignment or flag_modified to detect changes
            from sqlalchemy.orm.attributes import flag_modified
            rps.cpmk = updated_cpmk
            flag_modified(rps, "cpmk")
            
            rps.sub_cpmk = updated_sub_cpmk
            flag_modified(rps, "sub_cpmk")
            
            await db.commit()
            await db.refresh(rps)
            
        return {
            "status": "success",
            "cpmk": rps.cpmk,
            "sub_cpmk": rps.sub_cpmk,
            "reasoning": data.get("reasoning", ""),
            "message": "Deteksi dan perbaikan taksonomi Bloom (CPMK & Sub-CPMK) selesai!" if changed else "Taksonomi Bloom sudah sesuai, tidak ada perubahan."
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Gagal melakukan analisis taksonomi Bloom dengan AI: {str(e)}"
        )


@router.post("/{rps_id}/copy", response_model=RPSResponse, status_code=status.HTTP_201_CREATED)
async def copy_rps(
    rps_id: int,
    data: RPSCopyRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(RPS).where(RPS.id == rps_id))
    orig = result.scalar_one_or_none()
    if not orig:
        raise HTTPException(status_code=404, detail="RPS tidak ditemukan")
    
    target_ta = (data.target_tahun_akademik or "").strip()
    if not target_ta:
        raise HTTPException(status_code=400, detail="Target tahun akademik wajib diisi")
    
    # Check if RPS already exists for this mata_kuliah_id and target_tahun_akademik
    existing = await db.execute(
        select(RPS).where(
            RPS.mata_kuliah_id == orig.mata_kuliah_id,
            RPS.tahun_akademik == target_ta
        )
    )
    if existing.scalars().first():
        raise HTTPException(
            status_code=400,
            detail=f"RPS untuk mata kuliah ini pada periode '{target_ta}' sudah ada."
        )
    
    mk_result = await db.execute(select(MataKuliah).where(MataKuliah.id == orig.mata_kuliah_id))
    mk = mk_result.scalar_one_or_none()
    mk_kode = mk.kode if mk else "MK"
    
    clean_ta = "".join(c for c in target_ta if c.isalnum() or c in "-_")
    base_kode = f"RPS-{mk_kode}-{orig.semester}-{clean_ta}" if clean_ta else f"RPS-{mk_kode}-{orig.semester}"
    chk_kode = await db.execute(select(RPS).where(RPS.kode == base_kode))
    if chk_kode.scalar_one_or_none():
        final_kode = f"{base_kode}-{uuid.uuid4().hex[:4].upper()}"
    else:
        final_kode = base_kode

    # Clone identitas with updated target_tahun_akademik
    identitas = copy.deepcopy(orig.identitas) if orig.identitas else {}
    identitas["tahun_akademik"] = target_ta
    if data.dosen_pengampu is not None:
        dosen_pengampu = data.dosen_pengampu
        identitas["dosen_pengampu"] = dosen_pengampu
    else:
        dosen_pengampu = copy.deepcopy(orig.dosen_pengampu) if orig.dosen_pengampu else []

    new_rps = RPS(
        kode=final_kode,
        mata_kuliah_id=orig.mata_kuliah_id,
        prodi_id=orig.prodi_id,
        semester=orig.semester,
        tahun_akademik=target_ta,
        dosen_pengampu=dosen_pengampu,
        identitas=identitas,
        deskripsi_mata_kuliah=orig.deskripsi_mata_kuliah or "",
        bahan_kajian=copy.deepcopy(orig.bahan_kajian) or [],
        cpmk=copy.deepcopy(orig.cpmk) or [],
        sub_cpmk=copy.deepcopy(orig.sub_cpmk) or [],
        rencana_pembelajaran=copy.deepcopy(orig.rencana_pembelajaran) or [],
        metode_pembelajaran=copy.deepcopy(orig.metode_pembelajaran) or [],
        media_pembelajaran=copy.deepcopy(orig.media_pembelajaran) if orig.media_pembelajaran else None,
        penilaian=copy.deepcopy(orig.penilaian) or [],
        referensi=copy.deepcopy(orig.referensi) if orig.referensi else None,
        sdgs=copy.deepcopy(orig.sdgs) or [],
        status=data.target_status or "draft",
        obe_validated=orig.obe_validated or False,
        obe_validation_result=copy.deepcopy(orig.obe_validation_result) if orig.obe_validation_result else None,
        obe_score=orig.obe_score,
    )
    db.add(new_rps)
    await db.commit()
    await db.refresh(new_rps)
    return new_rps


@router.post("/bulk-copy", response_model=dict, status_code=status.HTTP_201_CREATED)
async def bulk_copy_rps(
    data: RPSBulkCopyRequest,
    db: AsyncSession = Depends(get_db),
):
    source_ta = (data.source_tahun_akademik or "").strip()
    target_ta = (data.target_tahun_akademik or "").strip()
    if not source_ta or not target_ta:
        raise HTTPException(status_code=400, detail="Sumber dan target tahun akademik wajib diisi")
    
    if source_ta.lower() == target_ta.lower():
        raise HTTPException(status_code=400, detail="Periode sumber dan periode target tidak boleh sama")

    # 1. Try exact match first
    query = select(RPS).where(RPS.tahun_akademik == source_ta)
    if data.prodi_id and str(data.prodi_id) != "all":
        try:
            pid = int(data.prodi_id)
            query = query.where(RPS.prodi_id == pid)
        except ValueError:
            pass
            
    if data.statuses and len(data.statuses) > 0:
        query = query.where(RPS.status.in_(data.statuses))

    result = await db.execute(query)
    source_items = result.scalars().all()

    # 2. If no exact match, try flexible matching (e.g. "2024/2025" within "2024/2025 Genap" or vice-versa)
    if not source_items:
        year_match = re.search(r"\d{4}/\d{4}|\d{4}", source_ta)
        year_str = year_match.group(0) if year_match else source_ta

        flex_query = select(RPS).where(
            (RPS.tahun_akademik.ilike(f"%{source_ta}%")) |
            (RPS.tahun_akademik == year_str) |
            (RPS.tahun_akademik.ilike(f"%{year_str}%"))
        )
        if data.prodi_id and str(data.prodi_id) != "all":
            try:
                pid = int(data.prodi_id)
                flex_query = flex_query.where(RPS.prodi_id == pid)
            except ValueError:
                pass

        if data.statuses and len(data.statuses) > 0:
            flex_query = flex_query.where(RPS.status.in_(data.statuses))

        flex_res = await db.execute(flex_query)
        source_items = flex_res.scalars().all()

    if not source_items:
        raise HTTPException(
            status_code=404,
            detail=f"Tidak ada RPS yang ditemukan untuk periode '{source_ta}' dengan kriteria yang dipilih."
        )

    # Fetch existing target RPS to avoid duplicates if skip_existing is True
    existing_res = await db.execute(select(RPS).where(RPS.tahun_akademik == target_ta))
    existing_mk_ids = set(r.mata_kuliah_id for r in existing_res.scalars().all())

    copied = []
    skipped = []
    errors = []

    for orig in source_items:
        if orig.mata_kuliah_id in existing_mk_ids and data.skip_existing:
            skipped.append({
                "id": orig.id,
                "kode": orig.kode,
                "mata_kuliah_id": orig.mata_kuliah_id,
                "reason": f"RPS untuk MK ini sudah ada di periode '{target_ta}'"
            })
            continue

        try:
            mk_res = await db.execute(select(MataKuliah).where(MataKuliah.id == orig.mata_kuliah_id))
            mk = mk_res.scalar_one_or_none()
            mk_kode = mk.kode if mk else "MK"
            mk_nama = mk.nama if mk else (orig.identitas.get("nama_mata_kuliah") if orig.identitas else "Mata Kuliah")

            clean_ta = "".join(c for c in target_ta if c.isalnum() or c in "-_")
            base_kode = f"RPS-{mk_kode}-{orig.semester}-{clean_ta}" if clean_ta else f"RPS-{mk_kode}-{orig.semester}"
            chk_kode = await db.execute(select(RPS).where(RPS.kode == base_kode))
            if chk_kode.scalar_one_or_none():
                final_kode = f"{base_kode}-{uuid.uuid4().hex[:4].upper()}"
            else:
                final_kode = base_kode

            identitas = copy.deepcopy(orig.identitas) if orig.identitas else {}
            identitas["tahun_akademik"] = target_ta

            new_rps = RPS(
                kode=final_kode,
                mata_kuliah_id=orig.mata_kuliah_id,
                prodi_id=orig.prodi_id,
                semester=orig.semester,
                tahun_akademik=target_ta,
                dosen_pengampu=copy.deepcopy(orig.dosen_pengampu) or [],
                identitas=identitas,
                deskripsi_mata_kuliah=orig.deskripsi_mata_kuliah or "",
                bahan_kajian=copy.deepcopy(orig.bahan_kajian) or [],
                cpmk=copy.deepcopy(orig.cpmk) or [],
                sub_cpmk=copy.deepcopy(orig.sub_cpmk) or [],
                rencana_pembelajaran=copy.deepcopy(orig.rencana_pembelajaran) or [],
                metode_pembelajaran=copy.deepcopy(orig.metode_pembelajaran) or [],
                media_pembelajaran=copy.deepcopy(orig.media_pembelajaran) if orig.media_pembelajaran else None,
                penilaian=copy.deepcopy(orig.penilaian) or [],
                referensi=copy.deepcopy(orig.referensi) if orig.referensi else None,
                sdgs=copy.deepcopy(orig.sdgs) or [],
                status=data.target_status or "draft",
                obe_validated=orig.obe_validated or False,
                obe_validation_result=copy.deepcopy(orig.obe_validation_result) if orig.obe_validation_result else None,
                obe_score=orig.obe_score,
            )
            db.add(new_rps)
            existing_mk_ids.add(orig.mata_kuliah_id)
            copied.append({
                "source_id": orig.id,
                "source_kode": orig.kode,
                "nama": mk_nama,
                "target_kode": final_kode,
                "status": data.target_status or "draft",
            })
        except Exception as e:
            errors.append({
                "source_id": orig.id,
                "kode": orig.kode,
                "error": str(e),
            })

    await db.commit()
    return {
        "success": True,
        "total": len(source_items),
        "copied": len(copied),
        "skipped": len(skipped),
        "errors": len(errors),
        "detail": copied,
        "skipped_detail": skipped,
        "error_detail": errors,
    }


@router.post("/copy-selected", response_model=dict, status_code=status.HTTP_201_CREATED)
async def copy_selected_rps(
    data: RPSCopySelectedRequest,
    db: AsyncSession = Depends(get_db),
):
    if not data.rps_ids:
        raise HTTPException(status_code=400, detail="Pilih minimal 1 RPS untuk disalin")

    target_ta = (data.target_tahun_akademik or "").strip()
    if not target_ta:
        raise HTTPException(status_code=400, detail="Target tahun akademik wajib diisi")

    result = await db.execute(select(RPS).where(RPS.id.in_(data.rps_ids)))
    items = result.scalars().all()
    if not items:
        raise HTTPException(status_code=404, detail="RPS yang dipilih tidak ditemukan")

    existing_res = await db.execute(select(RPS).where(RPS.tahun_akademik == target_ta))
    existing_mk_ids = set(r.mata_kuliah_id for r in existing_res.scalars().all())

    copied = []
    skipped = []
    errors = []

    for orig in items:
        if orig.mata_kuliah_id in existing_mk_ids and data.skip_existing:
            skipped.append({
                "id": orig.id,
                "kode": orig.kode,
                "mata_kuliah_id": orig.mata_kuliah_id,
                "reason": f"RPS untuk MK ini sudah ada di periode '{target_ta}'"
            })
            continue

        try:
            mk_res = await db.execute(select(MataKuliah).where(MataKuliah.id == orig.mata_kuliah_id))
            mk = mk_res.scalar_one_or_none()
            mk_kode = mk.kode if mk else "MK"
            mk_nama = mk.nama if mk else (orig.identitas.get("nama_mata_kuliah") if orig.identitas else "Mata Kuliah")

            clean_ta = "".join(c for c in target_ta if c.isalnum() or c in "-_")
            base_kode = f"RPS-{mk_kode}-{orig.semester}-{clean_ta}" if clean_ta else f"RPS-{mk_kode}-{orig.semester}"
            chk_kode = await db.execute(select(RPS).where(RPS.kode == base_kode))
            if chk_kode.scalar_one_or_none():
                final_kode = f"{base_kode}-{uuid.uuid4().hex[:4].upper()}"
            else:
                final_kode = base_kode

            identitas = copy.deepcopy(orig.identitas) if orig.identitas else {}
            identitas["tahun_akademik"] = target_ta

            new_rps = RPS(
                kode=final_kode,
                mata_kuliah_id=orig.mata_kuliah_id,
                prodi_id=orig.prodi_id,
                semester=orig.semester,
                tahun_akademik=target_ta,
                dosen_pengampu=copy.deepcopy(orig.dosen_pengampu) or [],
                identitas=identitas,
                deskripsi_mata_kuliah=orig.deskripsi_mata_kuliah or "",
                bahan_kajian=copy.deepcopy(orig.bahan_kajian) or [],
                cpmk=copy.deepcopy(orig.cpmk) or [],
                sub_cpmk=copy.deepcopy(orig.sub_cpmk) or [],
                rencana_pembelajaran=copy.deepcopy(orig.rencana_pembelajaran) or [],
                metode_pembelajaran=copy.deepcopy(orig.metode_pembelajaran) or [],
                media_pembelajaran=copy.deepcopy(orig.media_pembelajaran) if orig.media_pembelajaran else None,
                penilaian=copy.deepcopy(orig.penilaian) or [],
                referensi=copy.deepcopy(orig.referensi) if orig.referensi else None,
                sdgs=copy.deepcopy(orig.sdgs) or [],
                status=data.target_status or "draft",
                obe_validated=orig.obe_validated or False,
                obe_validation_result=copy.deepcopy(orig.obe_validation_result) if orig.obe_validation_result else None,
                obe_score=orig.obe_score,
            )
            db.add(new_rps)
            existing_mk_ids.add(orig.mata_kuliah_id)
            copied.append({
                "source_id": orig.id,
                "source_kode": orig.kode,
                "nama": mk_nama,
                "target_kode": final_kode,
                "status": data.target_status or "draft",
            })
        except Exception as e:
            errors.append({
                "source_id": orig.id,
                "kode": orig.kode,
                "error": str(e),
            })

    await db.commit()
    return {
        "success": True,
        "total": len(items),
        "copied": len(copied),
        "skipped": len(skipped),
        "errors": len(errors),
        "detail": copied,
        "skipped_detail": skipped,
        "error_detail": errors,
    }


def parse_xlsx_to_rows(file_bytes: bytes) -> List[List[str]]:
    """Parse XLSX worksheet to rows of strings without heavy external dependencies."""
    with zipfile.ZipFile(io.BytesIO(file_bytes), "r") as z:
        shared_strings = []
        if "xl/sharedStrings.xml" in z.namelist():
            tree = ET.fromstring(z.read("xl/sharedStrings.xml"))
            for si in tree.findall("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si"):
                t = si.find("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t")
                if t is not None and t.text:
                    shared_strings.append(t.text)
                else:
                    text_parts = [t_node.text for t_node in si.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t") if t_node.text]
                    shared_strings.append("".join(text_parts))

        sheet_files = [n for n in z.namelist() if n.startswith("xl/worksheets/sheet") and n.endswith(".xml")]
        sheet_path = sheet_files[0] if sheet_files else "xl/worksheets/sheet1.xml"

        sheet_tree = ET.fromstring(z.read(sheet_path))
        rows = []
        for r in sheet_tree.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row"):
            row_cells = []
            for c in r.findall("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c"):
                t = c.get("t")
                v = c.find("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v")
                val = ""
                if v is not None and v.text is not None:
                    val = v.text
                    if t == "s":
                        idx = int(val)
                        if idx < len(shared_strings):
                            val = shared_strings[idx]
                row_cells.append(str(val).strip())
            if any(row_cells):
                rows.append(row_cells)
        return rows


def parse_csv_to_rows(text: str) -> List[List[str]]:
    """Parse CSV / TSV text to rows of strings."""
    lines = text.strip().splitlines()
    if not lines:
        return []
    first = lines[0]
    delimiter = "\t" if "\t" in first else (";" if ";" in first else ("," if "," in first else "|"))
    reader = csv.reader(lines, delimiter=delimiter)
    return [[col.strip() for col in row] for row in reader if any(col.strip() for col in row)]


def extract_and_group_jadwal(rows: List[List[str]]) -> List[Dict[str, Any]]:
    """Smart parser that extracts MK & Dosen from schedule while ignoring operational columns."""
    if not rows:
        return []

    # Find header row
    header_idx = -1
    for i, r in enumerate(rows[:15]):
        row_text = " ".join(r).lower()
        if ("kode" in row_text or "kode mk" in row_text) and ("mata kuliah" in row_text or "nama" in row_text):
            header_idx = i
            break

    if header_idx == -1:
        # Fallback if no explicit header: treat row 0 as header or positional
        header_idx = 0

    header = [h.lower().strip() for h in rows[header_idx]]
    col_map = {}
    for i, h in enumerate(header):
        hl = h.lower().replace("_", " ").strip()
        if any(k in hl for k in ["kode mk", "kode_mk", "kodemk", "kode mata kuliah", "kd mk", "kode"]):
            if "kode" not in col_map: col_map["kode"] = i
        elif any(k in hl for k in ["nama mata kuliah", "nama mk", "nama_mk", "mata kuliah", "matakuliah", "nama"]):
            if "nama" not in col_map: col_map["nama"] = i
        elif any(k in hl for k in ["sks", "bobot", "credit"]):
            if "sks" not in col_map: col_map["sks"] = i
        elif any(k in hl for k in ["semester", "smt", "sem"]):
            if "semester" not in col_map: col_map["semester"] = i
        elif any(k in hl for k in ["kurikulum", "prodi", "program studi", "jurusan"]):
            if "kurikulum" not in col_map: col_map["kurikulum"] = i
        elif any(k in hl for k in ["team teaching", "tim teaching", "dosen team", "team", "tim", "dosen 2", "dosen kedua"]):
            if "team" not in col_map: col_map["team"] = i
        elif any(k in hl for k in ["dosen pengampu", "dosen", "pengampu", "nama dosen", "dosen 1", "dosen utama"]):
            if "dosen" not in col_map: col_map["dosen"] = i
        elif any(k in hl for k in ["kelas", "jenis kelas", "seksi", "paralel"]):
            if "kelas" not in col_map: col_map["kelas"] = i

    # Fallbacks for missing columns
    if "kode" not in col_map and len(header) > 0: col_map["kode"] = 0
    if "nama" not in col_map and len(header) > 1: col_map["nama"] = 1
    if "dosen" not in col_map and len(header) > 2: col_map["dosen"] = 2

    grouped: Dict[str, Dict[str, Any]] = {}
    data_rows = rows[header_idx + 1:]

    def split_dosen_names(raw: str) -> List[str]:
        if not raw or raw in ["-", "None", "none", "null", ""]:
            return []
        # Split by newline, semicolon, or slash (avoid splitting standard degree commas like M.Kom., S.T.)
        parts = re.split(r"[\n;\/]+", raw)
        result = []
        for p in parts:
            clean = p.strip().strip("-").strip()
            if clean and len(clean) > 2 and clean.lower() not in ["none", "null", "tidak ada", "-", "belum ada"]:
                result.append(clean)
        return result

    for r in data_rows:
        kode = r[col_map["kode"]].strip() if "kode" in col_map and col_map["kode"] < len(r) else ""
        if not kode or kode.lower() in ["kode", "kode mk", "no", "-", "none"]:
            continue

        nama = r[col_map["nama"]].strip() if "nama" in col_map and col_map["nama"] < len(r) else ""
        sks_raw = r[col_map["sks"]].strip() if "sks" in col_map and col_map["sks"] < len(r) else ""
        sks = int(sks_raw) if sks_raw.isdigit() else 3

        sem_raw = r[col_map["semester"]].strip() if "semester" in col_map and col_map["semester"] < len(r) else ""
        sem = int(sem_raw) if sem_raw.isdigit() else 1

        kur = r[col_map["kurikulum"]].strip() if "kurikulum" in col_map and col_map["kurikulum"] < len(r) else ""
        dosen_raw = r[col_map["dosen"]].strip() if "dosen" in col_map and col_map["dosen"] < len(r) else ""
        team_raw = r[col_map["team"]].strip() if "team" in col_map and col_map["team"] < len(r) else ""
        kelas = r[col_map["kelas"]].strip() if "kelas" in col_map and col_map["kelas"] < len(r) else ""

        # Derive clean prodi name from Kurikulum string (e.g. "MANAJEMEN GENAP 2025/2026" -> "MANAJEMEN")
        prodi_name = kur
        if kur:
            clean_p = re.sub(r"\b(ganjil|genap|pendek|20\d\d/20\d\d|20\d\d)\b", "", kur, flags=re.IGNORECASE).strip()
            if clean_p:
                prodi_name = clean_p

        key = f"{kode.upper()}_{kur.upper()}_{sem}"
        if key not in grouped:
            grouped[key] = {
                "kode_mk": kode.upper(),
                "nama_mk": nama,
                "sks": sks,
                "semester": sem,
                "kurikulum": kur,
                "prodi_nama": prodi_name,
                "prodi_id": None,
                "dosen_pengampu": [],
                "team_teaching": [],
                "semua_dosen": [],
                "kelas_list": [],
            }

        item = grouped[key]
        if kelas and kelas not in item["kelas_list"]:
            item["kelas_list"].append(kelas)

        for d in split_dosen_names(dosen_raw):
            if d not in item["dosen_pengampu"]:
                item["dosen_pengampu"].append(d)
            if d not in item["semua_dosen"]:
                item["semua_dosen"].append(d)

        for t in split_dosen_names(team_raw):
            if t not in item["team_teaching"]:
                item["team_teaching"].append(t)
            if t not in item["semua_dosen"]:
                item["semua_dosen"].append(t)

    return list(grouped.values())


@router.post("/parse-jadwal", response_model=List[JadwalItemExtracted])
async def parse_jadwal(
    file: Optional[UploadFile] = File(None),
    raw_text: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """Parse uploaded XLSX or CSV schedule and extract grouped MK & Lecturers."""
    rows: List[List[str]] = []
    if file:
        content = await file.read()
        filename = (file.filename or "").lower()
        if filename.endswith(".xlsx") or filename.endswith(".xlsm") or content.startswith(b"PK"):
            try:
                rows = parse_xlsx_to_rows(content)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Gagal membaca file Excel (.xlsx): {str(e)}")
        else:
            try:
                text = content.decode("utf-8-sig", errors="replace")
                rows = parse_csv_to_rows(text)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Gagal membaca file teks/CSV: {str(e)}")
    elif raw_text and raw_text.strip():
        rows = parse_csv_to_rows(raw_text)
    else:
        raise HTTPException(status_code=400, detail="Harap unggah file (.xlsx / .csv) atau masukkan teks tabel jadwal")

    extracted = extract_and_group_jadwal(rows)
    if not extracted:
        raise HTTPException(status_code=400, detail="Tidak ada data mata kuliah dan dosen yang dapat diekstrak dari file jadwal")

    # Match prodi_id from database if available
    prodis_res = await db.execute(select(Prodi))
    prodis = prodis_res.scalars().all()
    for item in extracted:
        p_name = item.get("prodi_nama", "").lower()
        kur = item.get("kurikulum", "").lower()
        for p in prodis:
            if p.nama.lower() in p_name or p_name in p.nama.lower() or p.nama.lower() in kur or p.kode.lower() in kur:
                item["prodi_id"] = p.id
                item["prodi_nama"] = p.nama
                break

    return extracted


@router.post("/sync-jadwal-dosen", response_model=JadwalSyncResponse)
async def sync_jadwal_dosen(
    data: JadwalSyncRequest,
    db: AsyncSession = Depends(get_db),
):
    """Smart-match extracted schedule to RPS records in target academic period and update lecturers."""
    target_ta = data.target_tahun_akademik.strip()
    if not target_ta:
        raise HTTPException(status_code=400, detail="Periode akademik target wajib diisi")

    # Load all Prodi
    prodis_res = await db.execute(select(Prodi))
    prodis = {p.id: p for p in prodis_res.scalars().all()}
    prodi_by_name = {p.nama.lower().strip(): p for p in prodis.values()}

    # Load all MataKuliah
    mk_query = select(MataKuliah)
    if data.prodi_id and data.prodi_id != "all":
        try:
            pid = int(data.prodi_id)
            mk_query = mk_query.where(MataKuliah.prodi_id == pid)
        except Exception:
            pass
    mk_res = await db.execute(mk_query)
    all_mk = mk_res.scalars().all()

    # Index MK by (kode_upper, prodi_id) and also (kode_upper)
    mk_map_strict: Dict[str, MataKuliah] = {}
    mk_map_by_kode: Dict[str, List[MataKuliah]] = {}
    for mk in all_mk:
        strict_k = f"{mk.kode.upper().strip()}_{mk.prodi_id}"
        mk_map_strict[strict_k] = mk
        k_upper = mk.kode.upper().strip()
        if k_upper not in mk_map_by_kode:
            mk_map_by_kode[k_upper] = []
        mk_map_by_kode[k_upper].append(mk)

    # Load all RPS in target period
    rps_query = select(RPS).where(RPS.tahun_akademik == target_ta)
    rps_res = await db.execute(rps_query)
    all_rps = rps_res.scalars().all()
    rps_by_mk_id: Dict[int, RPS] = {r.mata_kuliah_id: r for r in all_rps}

    updated_count = 0
    skipped_count = 0
    not_found_count = 0
    detail = []

    for item in data.items:
        kode = item.kode_mk.upper().strip()
        dosen_list = item.semua_dosen or item.dosen_pengampu or []

        if not dosen_list:
            skipped_count += 1
            detail.append({
                "kode": kode,
                "nama": item.nama_mk,
                "status": "skipped",
                "message": "Tidak ada nama dosen pengampu di jadwal",
            })
            continue

        # Find target Prodi
        target_prodi_id = item.prodi_id
        if not target_prodi_id and item.prodi_nama:
            p_match = prodi_by_name.get(item.prodi_nama.lower().strip())
            if p_match:
                target_prodi_id = p_match.id

        # Find matching MataKuliah
        matched_mk: Optional[MataKuliah] = None
        if target_prodi_id:
            strict_k = f"{kode}_{target_prodi_id}"
            matched_mk = mk_map_strict.get(strict_k)

        if not matched_mk and kode in mk_map_by_kode:
            matched_mk = mk_map_by_kode[kode][0]

        # Auto-create Mata Kuliah if not found and auto_create is enabled (or default)
        if not matched_mk:
            if data.auto_create_rps_draft is not False:
                try:
                    p_id = target_prodi_id or (list(prodis.keys())[0] if prodis else 1)
                    new_mk = MataKuliah(
                        kode=kode,
                        nama=item.nama_mk or kode,
                        sks=item.sks or 3,
                        sks_teori=max(1, (item.sks or 3) - 1),
                        sks_praktik=1 if (item.sks or 3) > 2 else 0,
                        semester=item.semester or 1,
                        prodi_id=p_id,
                        periode="",
                        status="aktif",
                    )
                    db.add(new_mk)
                    await db.flush()
                    await db.refresh(new_mk)
                    matched_mk = new_mk
                    mk_map_strict[f"{kode}_{p_id}"] = new_mk
                except Exception as ex:
                    not_found_count += 1
                    detail.append({
                        "kode": kode,
                        "nama": item.nama_mk,
                        "status": "mk_error",
                        "message": f"Gagal mendaftarkan MK baru: {str(ex)}",
                    })
                    continue
            else:
                not_found_count += 1
                detail.append({
                    "kode": kode,
                    "nama": item.nama_mk,
                    "status": "mk_not_found",
                    "message": f"Mata kuliah '{kode}' belum terdaftar di database",
                })
                continue

        # Check existing RPS in target period
        rps_record = rps_by_mk_id.get(matched_mk.id)

        if rps_record:
            # 1. Update dosen_pengampu on existing RPS
            rps_record.dosen_pengampu = dosen_list
            identitas = dict(rps_record.identitas or {})
            identitas["dosen_pengampu"] = dosen_list
            rps_record.identitas = identitas
            flag_modified(rps_record, "identitas")
            flag_modified(rps_record, "dosen_pengampu")

            updated_count += 1
            detail.append({
                "kode": kode,
                "nama": matched_mk.nama,
                "rps_kode": rps_record.kode,
                "status": "updated",
                "dosen": dosen_list,
                "message": f"Dosen pengampu berhasil disinkronkan: {', '.join(dosen_list)}",
            })
        else:
            # 2. RPS not yet created for target period -> Auto-create Draft RPS!
            if data.auto_create_rps_draft is not False:
                try:
                    # Look for previous RPS for this MK to inherit learning outcomes/weekly plans
                    prev_rps_query = select(RPS).where(RPS.mata_kuliah_id == matched_mk.id).order_by(RPS.id.desc())
                    prev_res = await db.execute(prev_rps_query)
                    prev_rps = prev_res.scalars().first()

                    clean_ta = re.sub(r"[^a-zA-Z0-9]", "", target_ta)
                    base_kode = f"RPS-{matched_mk.kode}-{matched_mk.semester}-{clean_ta}"
                    final_kode = base_kode

                    # Ensure unique RPS kode
                    chk = await db.execute(select(RPS).where(RPS.kode == final_kode))
                    if chk.scalar_one_or_none():
                        final_kode = f"{base_kode}-{uuid.uuid4().hex[:4].upper()}"

                    p_obj = prodis.get(matched_mk.prodi_id)
                    prodi_label = p_obj.nama if p_obj else (item.prodi_nama or "")

                    if prev_rps:
                        # Clone from previous RPS
                        identitas = copy.deepcopy(prev_rps.identitas or {})
                        identitas["tahun_akademik"] = target_ta
                        identitas["dosen_pengampu"] = dosen_list
                        if prodi_label:
                            identitas["prodi"] = prodi_label

                        new_rps = RPS(
                            kode=final_kode,
                            mata_kuliah_id=matched_mk.id,
                            prodi_id=matched_mk.prodi_id,
                            semester=matched_mk.semester,
                            tahun_akademik=target_ta,
                            dosen_pengampu=dosen_list,
                            identitas=identitas,
                            deskripsi_mata_kuliah=prev_rps.deskripsi_mata_kuliah or "",
                            bahan_kajian=copy.deepcopy(prev_rps.bahan_kajian) or [],
                            cpmk=copy.deepcopy(prev_rps.cpmk) or [],
                            sub_cpmk=copy.deepcopy(prev_rps.sub_cpmk) or [],
                            rencana_pembelajaran=copy.deepcopy(prev_rps.rencana_pembelajaran) or [],
                            metode_pembelajaran=copy.deepcopy(prev_rps.metode_pembelajaran) or [],
                            media_pembelajaran=copy.deepcopy(prev_rps.media_pembelajaran) if prev_rps.media_pembelajaran else None,
                            penilaian=copy.deepcopy(prev_rps.penilaian) or [],
                            referensi=copy.deepcopy(prev_rps.referensi) if prev_rps.referensi else None,
                            sdgs=copy.deepcopy(prev_rps.sdgs) or [],
                            status="draft",
                            obe_validated=prev_rps.obe_validated or False,
                            obe_validation_result=copy.deepcopy(prev_rps.obe_validation_result) if prev_rps.obe_validation_result else None,
                            obe_score=prev_rps.obe_score,
                        )
                    else:
                        # Create fresh Draft RPS
                        identitas = {
                            "kode_mata_kuliah": matched_mk.kode,
                            "nama_mata_kuliah": matched_mk.nama,
                            "bobot_sks": matched_mk.sks,
                            "semester": matched_mk.semester,
                            "prodi": prodi_label,
                            "tahun_akademik": target_ta,
                            "dosen_pengampu": dosen_list,
                        }
                        new_rps = RPS(
                            kode=final_kode,
                            mata_kuliah_id=matched_mk.id,
                            prodi_id=matched_mk.prodi_id,
                            semester=matched_mk.semester,
                            tahun_akademik=target_ta,
                            dosen_pengampu=dosen_list,
                            identitas=identitas,
                            status="draft",
                        )

                    db.add(new_rps)
                    await db.flush()
                    rps_by_mk_id[matched_mk.id] = new_rps
                    updated_count += 1
                    detail.append({
                        "kode": kode,
                        "nama": matched_mk.nama,
                        "rps_kode": new_rps.kode,
                        "status": "created",
                        "dosen": dosen_list,
                        "message": f"Draft RPS baru berhasil dibuat & dosen disinkronkan: {', '.join(dosen_list)}",
                    })
                except Exception as ex:
                    not_found_count += 1
                    detail.append({
                        "kode": kode,
                        "nama": matched_mk.nama,
                        "status": "rps_create_error",
                        "message": f"Gagal membuat Draft RPS otomatis: {str(ex)}",
                        "dosen": dosen_list,
                    })
            else:
                not_found_count += 1
                detail.append({
                    "kode": kode,
                    "nama": matched_mk.nama,
                    "status": "rps_not_found",
                    "message": f"RPS untuk periode '{target_ta}' belum dibuat",
                    "dosen": dosen_list,
                })

    await db.commit()

    return JadwalSyncResponse(
        success=True,
        target_tahun_akademik=target_ta,
        total_items=len(data.items),
        updated_rps=updated_count,
        skipped=skipped_count,
        not_found_rps=not_found_count,
        detail=detail,
    )