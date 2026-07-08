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
    nama_inggris: Optional[str] = None
    sks: int = 3
    sks_teori: int = 2
    sks_praktik: int = 1
    semester: int
    prasyarat: Optional[List[str]] = []
    cpl_prodi: Optional[List[str]] = []
    cpmk: Optional[List[Dict[str, Any]]] = []
    sub_cpmk: Optional[List[Dict[str, Any]]] = []
    deskripsi: Optional[str] = None
    buku_teks: Optional[List[Dict[str, str]]] = []
    buku_rujukan: Optional[List[Dict[str, str]]] = []


class MataKuliahCreate(MataKuliahBase):
    prodi_id: Optional[int] = None


class MataKuliahUpdate(BaseModel):
    nama: Optional[str] = None
    nama_inggris: Optional[str] = None
    sks: Optional[int] = None
    sks_teori: Optional[int] = None
    sks_praktik: Optional[int] = None
    semester: Optional[int] = None
    prasyarat: Optional[List[str]] = None
    cpl_prodi: Optional[List[str]] = None
    cpmk: Optional[List[Dict[str, Any]]] = None
    sub_cpmk: Optional[List[Dict[str, Any]]] = None
    deskripsi: Optional[str] = None
    buku_teks: Optional[List[Dict[str, str]]] = None
    buku_rujukan: Optional[List[Dict[str, str]]] = None
    status: Optional[MataKuliahStatus] = None


class MataKuliahResponse(MataKuliahBase):
    id: int
    prodi_id: int
    status: MataKuliahStatus
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
    dosen_pengampu: Optional[List[Dict[str, Any]]] = []
    tahun_akademik: Optional[str] = ""
    tanggal_penyusunan: Optional[str] = ""
    no_dokumen: Optional[str] = ""
    koordinator_pengembang_rps: Optional[str] = ""
    koordinator_rmk: Optional[str] = ""
    ka_prodi: Optional[str] = ""


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
    dosen_pengampu: Optional[List[Dict[str, Any]]] = []
    identitas: Optional[RPSIdentitas] = None
    cpmk: Optional[List[RPSCPMK]] = []
    sub_cpmk: Optional[List[RPSSubCPMK]] = []
    rencana_pembelajaran: Optional[List[RPSRencanaMingguan]] = []
    metode_pembelajaran: Optional[List[str]] = []
    media_pembelajaran: Optional[Union[List[Any], Dict[str, Any], Any]] = None
    penilaian: Optional[List[RPSPenilaian]] = []
    referensi: Optional[Union[List[Any], Dict[str, Any], Any]] = None


class RPSCreate(RPSBase):
    pass


class RPSUpdate(BaseModel):
    dosen_pengampu: Optional[List[Dict[str, Any]]] = None
    identitas: Optional[RPSIdentitas] = None
    cpmk: Optional[List[RPSCPMK]] = None
    sub_cpmk: Optional[List[RPSSubCPMK]] = None
    rencana_pembelajaran: Optional[List[RPSRencanaMingguan]] = None
    metode_pembelajaran: Optional[List[str]] = None
    media_pembelajaran: Optional[Union[List[Any], Dict[str, Any], Any]] = None
    penilaian: Optional[List[RPSPenilaian]] = None
    referensi: Optional[Union[List[Any], Dict[str, Any], Any]] = None
    status: Optional[RPSStatus] = None


class RPSResponse(RPSBase):
    id: int
    kode: str
    status: RPSStatus
    obe_validated: bool
    obe_validation_result: Optional[Dict[str, Any]] = None
    obe_score: Optional[float] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    approved_by: Optional[int] = None

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