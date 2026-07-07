from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.core.database import get_db
from app.models import MataKuliah, Prodi
from app.schemas import (
    MataKuliahCreate, MataKuliahUpdate, MataKuliahResponse,
    PaginatedResponse,
)
from sqlalchemy import select, func

router = APIRouter(prefix="/mata-kuliah", tags=["Mata Kuliah"])


@router.get("/", response_model=PaginatedResponse)
async def list_mata_kuliah(
    prodi_id: int = None,
    semester: int = None,
    page: int = 1,
    size: int = 20,
    db: AsyncSession = Depends(get_db),
):
    query = select(MataKuliah)
    if prodi_id:
        query = query.where(MataKuliah.prodi_id == prodi_id)
    if semester:
        query = query.where(MataKuliah.semester == semester)
    
    query = query.offset((page - 1) * size).limit(size)
    result = await db.execute(query)
    items = result.scalars().all()
    
    count_query = select(func.count(MataKuliah.id))
    if prodi_id:
        count_query = count_query.where(MataKuliah.prodi_id == prodi_id)
    if semester:
        count_query = count_query.where(MataKuliah.semester == semester)
    count_result = await db.execute(count_query)
    total = count_result.scalar()
    
    return PaginatedResponse(
        items=[MataKuliahResponse.model_validate(m) for m in items],
        total=total,
        page=page,
        size=size,
        pages=(total + size - 1) // size,
    )


@router.get("/{mk_id}", response_model=MataKuliahResponse)
async def get_mata_kuliah(mk_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MataKuliah).where(MataKuliah.id == mk_id))
    mk = result.scalar_one_or_none()
    if not mk:
        raise HTTPException(status_code=404, detail="Mata kuliah not found")
    return mk


@router.post("/", response_model=MataKuliahResponse, status_code=status.HTTP_201_CREATED)
async def create_mata_kuliah(data: MataKuliahCreate, db: AsyncSession = Depends(get_db)):
    # Check prodi exists
    prodi_result = await db.execute(select(Prodi).where(Prodi.id == data.prodi_id))
    if not prodi_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Prodi not found")
    
    mk = MataKuliah(**data.model_dump())
    db.add(mk)
    await db.commit()
    await db.refresh(mk)
    return mk


@router.put("/{mk_id}", response_model=MataKuliahResponse)
async def update_mata_kuliah(mk_id: int, data: MataKuliahUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MataKuliah).where(MataKuliah.id == mk_id))
    mk = result.scalar_one_or_none()
    if not mk:
        raise HTTPException(status_code=404, detail="Mata kuliah not found")
    
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(mk, key, val)
    
    await db.commit()
    await db.refresh(mk)
    return mk


@router.post("/bulk", response_model=dict, status_code=status.HTTP_201_CREATED)
async def bulk_create_mata_kuliah(
    data: List[MataKuliahCreate],
    db: AsyncSession = Depends(get_db),
):
    if not data:
        raise HTTPException(status_code=400, detail="Data kosong")
    
    prodi_id = data[0].prodi_id
    prodi_result = await db.execute(select(Prodi).where(Prodi.id == prodi_id))
    if not prodi_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Prodi not found")
    
    created = []
    errors = []
    for item in data:
        try:
            mk = MataKuliah(**item.model_dump())
            db.add(mk)
            await db.flush()
            created.append({"kode": item.kode, "nama": item.nama, "id": mk.id})
        except Exception as e:
            errors.append({"kode": item.kode, "nama": item.nama, "error": str(e)})
    
    await db.commit()
    return {
        "success": True,
        "total": len(data),
        "created": len(created),
        "errors": len(errors),
        "detail": created,
        "error_detail": errors,
    }


@router.delete("/{mk_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mata_kuliah(mk_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MataKuliah).where(MataKuliah.id == mk_id))
    mk = result.scalar_one_or_none()
    if not mk:
        raise HTTPException(status_code=404, detail="Mata kuliah not found")
    await db.delete(mk)
    await db.commit()