from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.core.database import get_db
from app.models import RPS, Prodi, MataKuliah
from app.schemas import (
    RPSCreate, RPSUpdate, RPSResponse,
    PaginatedResponse,
)
from sqlalchemy import select, func, update
import uuid
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
    page: int = 1,
    size: int = 10,
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