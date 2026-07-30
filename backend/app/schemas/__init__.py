from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from enum import Enum


class ProdiStatus(str, Enum):
    AKTIF = "aktif"
    TIDAK_AKTIF = "tidak_aktif"


class MataKuliahStatus(str, Enum):
    AKTIF = "aktif"
    TIDAK_AKTIF = "tidak_aktif"
    ARSIP = "arsip"


class RPSStatus(str, Enum):
    DRAFT = "draft"
    REVIEW = "review"
    APPROVED = "approved"
    PUBLISHED = "published"


# Prodi Schemas
class ProdiBase(BaseModel):
    kode: str = Field(..., max_length=20)
    nama: str = Field(..., max_length=200)
    fakultas: str = Field(..., max_length=100)
    visi: str
    misi: str
    tujuan: Optional[str] = None
    sasaran: Optional[str] = None
    ka_prodi: Optional[str] = ""
    koordinator_rmk: Optional[str] = ""
    capaian_pembelajaran_lulusan: Optional[List[Dict[str, Any]]] = []


class ProdiCreate(ProdiBase):
    pass


class ProdiUpdate(BaseModel):
    nama: Optional[str] = None
    fakultas: Optional[str] = None
    visi: Optional[str] = None
    misi: Optional[str] = None
    tujuan: Optional[str] = None
    sasaran: Optional[str] = None
    ka_prodi: Optional[str] = None
    koordinator_rmk: Optional[str] = None
    capaian_pembelajaran_lulusan: Optional[List[Dict[str, Any]]] = None
    status: Optional[ProdiStatus] = None


class ProdiResponse(ProdiBase):
    id: int
    status: ProdiStatus
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Mata Kuliah Schemas
class MataKuliahBase(BaseModel):
    kode: str = Field(..., max_length=20)
    nama: str = Field(..., max_length=200)
    nama_inggris: Optional[Any] = None
    sks: Optional[Any] = 3
    sks_teori: Optional[Any] = 2
    sks_praktik: Optional[Any] = 1
    semester: Optional[Any] = 1
    prasyarat: Optional[Any] = []
    cpl_prodi: Optional[Any] = []
    cpmk: Optional[Any] = []
    sub_cpmk: Optional[Any] = []
    deskripsi: Optional[Any] = None
    buku_teks: Optional[Any] = []
    buku_rujukan: Optional[Any] = []
    sdgs: Optional[Any] = []


class MataKuliahCreate(MataKuliahBase):
    prodi_id: Optional[int] = None


class MataKuliahUpdate(BaseModel):
    nama: Optional[str] = None
    nama_inggris: Optional[str] = None
    sks: Optional[int] = None
    sks_teori: Optional[int] = None
    sks_praktik: Optional[int] = None
    semester: Optional[int] = None
    prasyarat: Optional[Any] = None
    cpl_prodi: Optional[Any] = None
    cpmk: Optional[Any] = None
    sub_cpmk: Optional[Any] = None
    deskripsi: Optional[str] = None
    buku_teks: Optional[Any] = None
    buku_rujukan: Optional[Any] = None
    status: Optional[Any] = None
    sdgs: Optional[Any] = None


class MataKuliahResponse(MataKuliahBase):
    id: int
    prodi_id: int
    status: Any = "aktif"
    created_at: Optional[Any] = None
    updated_at: Optional[Any] = None

    class Config:
        from_attributes = True
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# RPS Schemas
class RPSIdentitas(BaseModel):
    nama_mata_kuliah: str
    kode_mata_kuliah: str
    sks: int
    semester: int
    prodi: Optional[str] = ""
    fakultas: Optional[str] = ""
    dosen_pengampu: Optional[List[Union[Dict[str, Any], str, Any]]] = []
    tahun_akademik: Optional[str] = ""
    tanggal_penyusunan: Optional[str] = ""
    no_dokumen: Optional[str] = ""
    koordinator_pengembang_rps: Optional[str] = ""
    koordinator_rmk: Optional[str] = ""
    ka_prodi: Optional[str] = ""
    gugus_kendali_mutu: Optional[str] = ""


class RPSCPMK(BaseModel):
    kode: str
    deskripsi: str
    bobot: Optional[Union[float, int, str, Any]] = 0.0
    cpl_prodi: Optional[List[Any]] = []


class RPSSubCPMK(BaseModel):
    kode: str
    cpmk_kode: Optional[str] = ""
    deskripsi: str
    indikator: Optional[List[Any]] = []


class RPSRencanaMingguan(BaseModel):
    minggu_ke: int
    sub_cpmk_kode: str
    sub_cpmk_deskripsi: Optional[str] = None
    materi: str
    metode: Union[List[Any], str, Any]
    media: Optional[Union[List[Any], str, Any]] = None
    durasi: Optional[Union[int, str, Any]] = None  # backward compatibility
    estimasi_waktu: Optional[str] = None
    pengalaman_belajar: Optional[str] = None
    kriteria_penilaian: Optional[str] = None
    indikator: Optional[str] = None
    bobot: Optional[Union[int, float, str]] = None
    tugas: Optional[Any] = None
    penilaian: Optional[Any] = None


class RPSPenilaian(BaseModel):
    komponen: str
    bobot: Optional[Union[float, int, str, Any]] = 0.0
    jenis: Optional[str] = "tugas"  # tugas, uts, uas, kehadiran, dll
    kriteria: Optional[List[Any]] = []
    sub_cpmk_kode: Optional[List[Any]] = []


class RPSBase(BaseModel):
    mata_kuliah_id: int
    prodi_id: int
    semester: int
    tahun_akademik: str
    dosen_pengampu: Optional[Any] = []
    identitas: Optional[Any] = None
    deskripsi_mata_kuliah: Optional[Any] = ""
    bahan_kajian: Optional[Any] = []
    cpmk: Optional[Any] = []
    sub_cpmk: Optional[Any] = []
    rencana_pembelajaran: Optional[Any] = []
    metode_pembelajaran: Optional[Any] = []
    media_pembelajaran: Optional[Any] = None
    penilaian: Optional[Any] = []
    referensi: Optional[Any] = None
    sdgs: Optional[Any] = []


class RPSCreate(RPSBase):
    pass


class RPSUpdate(BaseModel):
    dosen_pengampu: Optional[Any] = None
    identitas: Optional[Any] = None
    deskripsi_mata_kuliah: Optional[Any] = None
    bahan_kajian: Optional[Any] = None
    cpmk: Optional[Any] = None
    sub_cpmk: Optional[Any] = None
    rencana_pembelajaran: Optional[Any] = None
    metode_pembelajaran: Optional[Any] = None
    media_pembelajaran: Optional[Any] = None
    penilaian: Optional[Any] = None
    referensi: Optional[Any] = None
    status: Optional[Any] = None
    sdgs: Optional[Any] = None


class RPSResponse(RPSBase):
    id: int
    kode: str
    status: Any = "draft"
    obe_validated: Optional[Any] = False
    obe_validation_result: Optional[Any] = None
    obe_score: Optional[Any] = None
    created_at: Optional[Any] = None
    updated_at: Optional[Any] = None
    approved_at: Optional[Any] = None
    approved_by: Optional[Any] = None

    class Config:
        from_attributes = True


# AI Generation Schemas
class RPSGenerateRequest(BaseModel):
    mata_kuliah_id: int
    prodi_id: int
    semester: int
    tahun_akademik: str
    dosen_pengampu: Optional[List[Dict[str, str]]] = []
    additional_context: Optional[str] = None


class BulkGenerateRequest(BaseModel):
    prodi_id: int
    semester: Optional[int] = None
    tahun_akademik: str
    dosen_pengampu: Optional[List[Dict[str, str]]] = []
    additional_context: Optional[str] = None


class OBEValidationRequest(BaseModel):
    rps_id: int


class OBEValidationResponse(BaseModel):
    rps_id: int
    validated: bool
    score: float
    issues: List[Dict[str, Any]]
    suggestions: List[Dict[str, Any]]
    details: Dict[str, Any]


# Export Schemas
class ExportRequest(BaseModel):
    rps_id: int
    format: str = "pdf"  # pdf, docx, html


class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    size: int
    pages: int