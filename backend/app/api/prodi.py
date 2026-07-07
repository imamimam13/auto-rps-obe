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


@router.post("/{prodi_id}/map-cpl-ai")
async def map_cpl_to_mata_kuliah_ai(
    prodi_id: int,
    db: AsyncSession = Depends(get_db),
):
    import json
    result = await db.execute(select(Prodi).where(Prodi.id == prodi_id))
    prodi = result.scalar_one_or_none()
    if not prodi:
        raise HTTPException(status_code=404, detail="Prodi not found")
        
    cpl_list = prodi.capaian_pembelajaran_lulusan or []
    if not cpl_list:
        raise HTTPException(status_code=400, detail="Prodi belum memiliki CPL. Silakan isi CPL prodi terlebih dahulu.")
        
    mk_result = await db.execute(select(MataKuliah).where(MataKuliah.prodi_id == prodi_id))
    mata_kuliah_list = mk_result.scalars().all()
    if not mata_kuliah_list:
        raise HTTPException(status_code=404, detail="Tidak ada mata kuliah ditemukan di prodi ini")
        
    from app.services.ollama_service import ollama_service
    from app.services.rps_generator import extract_json
    
    mapping_prompt_template = """Anda adalah ahli kurikulum OBE. Petakan CPL (Capaian Pembelajaran Lulusan) mana saja yang relevan dan berkontribusi langsung ke Mata Kuliah berikut:

DAFTAR CPL PRODI:
{cpl_list_json}

MATA KULIAH:
- Nama: {nama_mk}
- Kode: {kode_mk}
- Deskripsi: {deskripsi_mk}

Pilih kode CPL (misal: "CPL-1", "CPL-2") yang relevan dari daftar di atas. 
Mata kuliah biasanya berkontribusi ke 1 sampai 4 CPL saja. Jangan pilih terlalu banyak.
Gunakan HANYA kode CPL yang terdaftar secara resmi di atas. Dilarang keras mengarang kode CPL baru.

Keluarkan respon Anda HANYA dalam format JSON berikut:
{{
  "cpl_terkait": ["kode_cpl_1", "kode_cpl_2"]
}}"""

    mapped_count = 0
    for mk in mata_kuliah_list:
        cpl_list_json = json.dumps(cpl_list, indent=2)
        prompt = mapping_prompt_template.format(
            cpl_list_json=cpl_list_json,
            nama_mk=mk.nama,
            kode_mk=mk.kode,
            deskripsi_mk=mk.deskripsi or f"Mata kuliah terkait bidang keilmuan {mk.nama} dengan bobot {mk.sks} SKS."
        )
        
        try:
            response = await ollama_service.generate(
                prompt=prompt,
                system_prompt="Anda hanya mengeluarkan format JSON valid.",
                temperature=0.1,
            )
            result_json = extract_json(response)
            selected_cpls = result_json.get("cpl_terkait", [])
            
            # Filter selected CPLs to ensure they exist in the prodi CPL list
            valid_cpl_codes = {cpl.get("kode") for cpl in cpl_list if cpl.get("kode")}
            filtered_cpls = [c for c in selected_cpls if c in valid_cpl_codes]
            
            mk.cpl_prodi = filtered_cpls
            db.add(mk)
            mapped_count += 1
        except Exception as e:
            print(f"[MAP CPL MK ERROR] {mk.nama}: {e}")
            
    await db.commit()
    return {"success": True, "total": len(mata_kuliah_list), "mapped": mapped_count}


@router.post("/{prodi_id}/generate-cpl-ai")
async def generate_cpl_from_visi_misi_ai(
    prodi_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Prodi).where(Prodi.id == prodi_id))
    prodi = result.scalar_one_or_none()
    if not prodi:
        raise HTTPException(status_code=404, detail="Prodi not found")
        
    if not prodi.visi or not prodi.misi:
        raise HTTPException(status_code=400, detail="Visi dan Misi prodi harus diisi terlebih dahulu.")
        
    from app.services.ollama_service import ollama_service
    from app.services.rps_generator import extract_json
    
    prompt = f"""Anda adalah ahli kurikulum KKNI & SN-Dikti Indonesia. Rumuskan draf CPL (Capaian Pembelajaran Lulusan) yang selaras dengan Visi dan Misi program studi berikut:

NAMA PRODI: {prodi.nama}
VISI PRODI: {prodi.visi}
MISI PRODI: {prodi.misi}

Susunlah 8 sampai 12 CPL yang mencakup aspek:
1. Sikap (contoh kode: CPL-S1, CPL-S2, ...)
2. Keterampilan Umum (contoh kode: CPL-KU1, CPL-KU2, ...)
3. Keterampilan Khusus (contoh kode: CPL-KK1, CPL-KK2, ...)
4. Pengetahuan (contoh kode: CPL-P1, CPL-P2, ...)

Setiap CPL harus memiliki kode (contoh: "CPL-S1", "CPL-P1", "CPL-KU1", "CPL-KK1") dan deskripsi kompetensi yang spesifik dan terukur.

Keluarkan hasil HANYA dalam format array JSON valid berikut:
[
  {{
    "kode": "CPL-S1",
    "deskripsi": "..."
  }},
  {{
    "kode": "CPL-P1",
    "deskripsi": "..."
  }}
]"""

    try:
        response = await ollama_service.generate(
            prompt=prompt,
            system_prompt="Anda hanya mengeluarkan format array JSON CPL valid.",
            temperature=0.3,
        )
        cpl_json = extract_json(response)
        
        # Ensure it is a list
        if not isinstance(cpl_json, list):
            # Try to get list from keys if nested
            if isinstance(cpl_json, dict):
                found_list = False
                for k, v in cpl_json.items():
                    if isinstance(v, list):
                        cpl_json = v
                        found_list = True
                        break
                if not found_list:
                    # Fallback: if it is a flat mapping of "CPL_CODE": "Description text"
                    list_from_dict = []
                    for k, v in cpl_json.items():
                        if isinstance(v, str):
                            list_from_dict.append({"kode": k, "deskripsi": v})
                    if list_from_dict:
                        cpl_json = list_from_dict
            
            # If still not a list, raise error
            if not isinstance(cpl_json, list):
                raise ValueError("Format respon AI bukan array.")
                
        # Validate elements with synonym fallback
        validated_cpl = []
        for item in cpl_json:
            if not isinstance(item, dict):
                continue
                
            # Find kode key
            kode_key = None
            for k in ["kode", "kode_cpl", "cpl_kode", "id", "code"]:
                if k in item:
                    kode_key = k
                    break
            if not kode_key:
                for k in item.keys():
                    if "kode" in k.lower() or "code" in k.lower():
                        kode_key = k
                        break
                        
            # Find deskripsi key
            desc_key = None
            for k in ["deskripsi", "deskripsi_cpl", "cpl_deskripsi", "pernyataan", "statement", "description", "content", "cpl"]:
                if k in item:
                    desc_key = k
                    break
            if not desc_key:
                for k in item.keys():
                    k_lower = k.lower()
                    if "desk" in k_lower or "desc" in k_lower or "pernyataan" in k_lower or "cpl" in k_lower:
                        desc_key = k
                        break
                        
            # absolute fallback: use first and second keys
            if not kode_key and item.keys():
                kode_key = list(item.keys())[0]
            if not desc_key and len(item.keys()) > 1:
                desc_key = list(item.keys())[1]
                
            if kode_key and desc_key:
                validated_cpl.append({
                    "kode": str(item.get(kode_key)).strip(),
                    "deskripsi": str(item.get(desc_key)).strip()
                })
                
        if not validated_cpl:
            raise ValueError("Tidak ada CPL valid yang berhasil diekstrak.")
            
        prodi.capaian_pembelajaran_lulusan = validated_cpl
        db.add(prodi)
        await db.commit()
        await db.refresh(prodi)
        
        return {"success": True, "cpl": validated_cpl}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Gagal merumuskan CPL dengan AI. Detail: {str(e)}"
        )