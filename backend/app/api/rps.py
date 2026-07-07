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
    db: AsyncSession = Depends(get_db),
):
    query = select(RPS)
    if prodi_id:
        query = query.where(RPS.prodi_id == prodi_id)
    if mata_kuliah_id:
        query = query.where(RPS.mata_kuliah_id == mata_kuliah_id)
    if semester:
        query = query.where(RPS.semester == semester)
    if status:
        query = query.where(RPS.status == status)
    
    query = query.offset((page - 1) * size).limit(size)
    result = await db.execute(query)
    items = result.scalars().all()
    
    count_query = select(func.count(RPS.id))
    if prodi_id:
        count_query = count_query.where(RPS.prodi_id == prodi_id)
    if mata_kuliah_id:
        count_query = count_query.where(RPS.mata_kuliah_id == mata_kuliah_id)
    count_result = await db.execute(count_query)
    total = count_result.scalar()
    
    return PaginatedResponse(
        items=[RPSResponse.model_validate(r) for r in items],
        total=total,
        page=page,
        size=size,
        pages=(total + size - 1) // size,
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
        cpmk=[c if isinstance(c, dict) else c.model_dump() for c in (data.cpmk or [])],
        sub_cpmk=[s if isinstance(s, dict) else s.model_dump() for s in (data.sub_cpmk or [])],
        rencana_pembelajaran=[r if isinstance(r, dict) else r.model_dump() for r in (data.rencana_pembelajaran or [])],
        metode_pembelajaran=data.metode_pembelajaran or [],
        media_pembelajaran=data.media_pembelajaran or [],
        penilaian=[p if isinstance(p, dict) else p.model_dump() for p in (data.penilaian or [])],
        referensi=data.referensi or [],
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
    json_fields = ["identitas", "cpmk", "sub_cpmk", "rencana_pembelajaran", "metode_pembelajaran", "media_pembelajaran", "penilaian", "referensi"]
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