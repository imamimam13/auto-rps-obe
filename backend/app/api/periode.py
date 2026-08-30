from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.core.database import get_db
from app.models import Periode
from app.schemas import PeriodeCreate, PeriodeUpdate, PeriodeResponse, PaginatedResponse
from sqlalchemy import select, func, update

router = APIRouter(prefix="/periode", tags=["Periode"])

DEFAULT_PERIODES = [
    {"kode": "2023-1", "nama": "2023/2024 Ganjil", "tahun_akademik": "2023/2024", "semester_tipe": "ganjil", "is_active": False, "status": "arsip"},
    {"kode": "2023-2", "nama": "2023/2024 Genap", "tahun_akademik": "2023/2024", "semester_tipe": "genap", "is_active": False, "status": "arsip"},
    {"kode": "2024-1", "nama": "2024/2025 Ganjil", "tahun_akademik": "2024/2025", "semester_tipe": "ganjil", "is_active": False, "status": "selesai"},
    {"kode": "2024-2", "nama": "2024/2025 Genap", "tahun_akademik": "2024/2025", "semester_tipe": "genap", "is_active": True, "status": "aktif"},
    {"kode": "2025-1", "nama": "2025/2026 Ganjil", "tahun_akademik": "2025/2026", "semester_tipe": "ganjil", "is_active": False, "status": "aktif"},
]


async def seed_default_periodes(db: AsyncSession):
    """Seed initial periodes if database table is empty."""
    res = await db.execute(select(func.count(Periode.id)))
    count = res.scalar() or 0
    if count == 0:
        for p in DEFAULT_PERIODES:
            db.add(Periode(**p))
        await db.commit()


@router.get("/", response_model=PaginatedResponse)
async def list_periode(
    db: AsyncSession = Depends(get_db),
):
    await seed_default_periodes(db)
    query = select(Periode).order_by(Periode.id.desc())
    result = await db.execute(query)
    items = result.scalars().all()
    
    items_out = [PeriodeResponse.model_validate(p) for p in items]
    return PaginatedResponse(
        items=items_out,
        total=len(items_out),
        page=1,
        size=len(items_out) or 10,
        pages=1,
    )


@router.get("/active", response_model=PeriodeResponse)
async def get_active_periode(db: AsyncSession = Depends(get_db)):
    await seed_default_periodes(db)
    result = await db.execute(select(Periode).where(Periode.is_active == True))
    active = result.scalar_one_or_none()
    if not active:
        # Fallback to latest
        result_latest = await db.execute(select(Periode).order_by(Periode.id.desc()).limit(1))
        active = result_latest.scalar_one_or_none()
    if not active:
        raise HTTPException(status_code=404, detail="No active period found")
    return active


@router.post("/", response_model=PeriodeResponse, status_code=status.HTTP_201_CREATED)
async def create_periode(data: PeriodeCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Periode).where(Periode.kode == data.kode))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Periode dengan kode '{data.kode}' sudah ada")

    if data.is_active:
        await db.execute(update(Periode).values(is_active=False))

    periode = Periode(**data.model_dump())
    db.add(periode)
    await db.commit()
    await db.refresh(periode)
    return periode


@router.put("/{periode_id}/set-active", response_model=PeriodeResponse)
async def set_active_periode(periode_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Periode).where(Periode.id == periode_id))
    periode = result.scalar_one_or_none()
    if not periode:
        raise HTTPException(status_code=404, detail="Periode not found")

    # Set all other periods as inactive
    await db.execute(update(Periode).values(is_active=False))
    periode.is_active = True
    periode.status = "aktif"
    await db.commit()
    await db.refresh(periode)
    return periode


@router.put("/{periode_id}", response_model=PeriodeResponse)
async def update_periode(periode_id: int, data: PeriodeUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Periode).where(Periode.id == periode_id))
    periode = result.scalar_one_or_none()
    if not periode:
        raise HTTPException(status_code=404, detail="Periode not found")

    dump = data.model_dump(exclude_unset=True)
    if dump.get("is_active"):
        await db.execute(update(Periode).values(is_active=False))

    for key, val in dump.items():
        setattr(periode, key, val)

    await db.commit()
    await db.refresh(periode)
    return periode


@router.delete("/{periode_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_periode(periode_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Periode).where(Periode.id == periode_id))
    periode = result.scalar_one_or_none()
    if not periode:
        raise HTTPException(status_code=404, detail="Periode not found")
    await db.delete(periode)
    await db.commit()
