from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.core.database import get_db
from app.models import Prodi, MataKuliah
from app.schemas import (
    ProdiCreate, ProdiUpdate, ProdiResponse,
    PaginatedResponse,
)
from sqlalchemy import select, func

router = APIRouter(prefix="/prodi", tags=["Program Studi"])


@router.get("/", response_model=PaginatedResponse)
async def list_prodi(
    page: int = 1,
    size: int = 10,
    db: AsyncSession = Depends(get_db),
):
    query = select(Prodi).offset((page - 1) * size).limit(size)
    result = await db.execute(query)
    items = result.scalars().all()
    
    count_query = select(func.count(Prodi.id))
    count_result = await db.execute(count_query)
    total = count_result.scalar()
    
    return PaginatedResponse(
        items=[ProdiResponse.model_validate(p) for p in items],
        total=total,
        page=page,
        size=size,
        pages=(total + size - 1) // size,
    )


@router.get("/{prodi_id}", response_model=ProdiResponse)
async def get_prodi(prodi_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Prodi).where(Prodi.id == prodi_id))
    prodi = result.scalar_one_or_none()
    if not prodi:
        raise HTTPException(status_code=404, detail="Prodi not found")
    return prodi


@router.post("/", response_model=ProdiResponse, status_code=status.HTTP_201_CREATED)
async def create_prodi(data: ProdiCreate, db: AsyncSession = Depends(get_db)):
    prodi = Prodi(**data.model_dump())
    db.add(prodi)
    await db.commit()
    await db.refresh(prodi)
    return prodi


@router.put("/{prodi_id}", response_model=ProdiResponse)
async def update_prodi(prodi_id: int, data: ProdiUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Prodi).where(Prodi.id == prodi_id))
    prodi = result.scalar_one_or_none()
    if not prodi:
        raise HTTPException(status_code=404, detail="Prodi not found")
    
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(prodi, key, val)
    
    await db.commit()
    await db.refresh(prodi)
    return prodi


@router.delete("/{prodi_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_prodi(prodi_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Prodi).where(Prodi.id == prodi_id))
    prodi = result.scalar_one_or_none()
    if not prodi:
        raise HTTPException(status_code=404, detail="Prodi not found")
    await db.delete(prodi)
    await db.commit()