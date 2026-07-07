from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, JSON, Boolean, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class ProdiStatus(str, enum.Enum):
    AKTIF = "aktif"
    TIDAK_AKTIF = "tidak_aktif"


class MataKuliahStatus(str, enum.Enum):
    AKTIF = "aktif"
    TIDAK_AKTIF = "tidak_aktif"
    ARSIP = "arsip"


class RPSStatus(str, enum.Enum):
    DRAFT = "draft"
    REVIEW = "review"
    APPROVED = "approved"
    PUBLISHED = "published"


class Prodi(Base):
    __tablename__ = "prodi"
    
    id = Column(Integer, primary_key=True, index=True)
    kode = Column(String(20), unique=True, index=True, nullable=False)
    nama = Column(String(200), nullable=False)
    fakultas = Column(String(100), nullable=False)
    visi = Column(Text, nullable=False)
    misi = Column(Text, nullable=False)
    tujuan = Column(Text)
    sasaran = Column(Text)
    capaian_pembelajaran_lulusan = Column(JSON)  # CPL
    status = Column(Enum(ProdiStatus), default=ProdiStatus.AKTIF)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    mata_kuliah = relationship("MataKuliah", back_populates="prodi")
    rps = relationship("RPS", back_populates="prodi")


class MataKuliah(Base):
    __tablename__ = "mata_kuliah"
    
    id = Column(Integer, primary_key=True, index=True)
    kode = Column(String(20), unique=True, index=True, nullable=False)
    nama = Column(String(200), nullable=False)
    nama_inggris = Column(String(200))
    sks = Column(Integer, default=3)
    sks_teori = Column(Integer, default=2)
    sks_praktik = Column(Integer, default=1)
    semester = Column(Integer, nullable=False)
    prodi_id = Column(Integer, ForeignKey("prodi.id"), nullable=False)
    prasyarat = Column(JSON)  # List of mata kuliah kode
    cpl_prodi = Column(JSON)  # CPL yang berkontribusi
    cpmk = Column(JSON)  # Capaian Pembelajaran Mata Kuliah
    sub_cpmk = Column(JSON)  # Sub-CPMK
    deskripsi = Column(Text)
    buku_teks = Column(JSON)
    buku_rujukan = Column(JSON)
    status = Column(Enum(MataKuliahStatus), default=MataKuliahStatus.AKTIF)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    prodi = relationship("Prodi", back_populates="mata_kuliah")
    rps = relationship("RPS", back_populates="mata_kuliah")


class RPS(Base):
    __tablename__ = "rps"
    
    id = Column(Integer, primary_key=True, index=True)
    kode = Column(String(50), unique=True, index=True, nullable=False)
    mata_kuliah_id = Column(Integer, ForeignKey("mata_kuliah.id"), nullable=False)
    prodi_id = Column(Integer, ForeignKey("prodi.id"), nullable=False)
    semester = Column(Integer, nullable=False)
    tahun_akademik = Column(String(20), nullable=False)
    dosen_pengampu = Column(JSON)  # List of dosen
    status = Column(Enum(RPSStatus), default=RPSStatus.DRAFT)
    
    # RPS Content (JSON for flexibility)
    identitas = Column(JSON)
    cpmk = Column(JSON)
    sub_cpmk = Column(JSON)
    rencana_pembelajaran = Column(JSON)  # Mingguan
    metode_pembelajaran = Column(JSON)
    media_pembelajaran = Column(JSON)
    penilaian = Column(JSON)  # Bobot, jenis, kriteria
    referensi = Column(JSON)
    
    # OBE Validation
    obe_validated = Column(Boolean, default=False)
    obe_validation_result = Column(JSON)
    obe_score = Column(Float)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    approved_at = Column(DateTime(timezone=True), nullable=True)
    approved_by = Column(Integer, nullable=True)
    
    mata_kuliah = relationship("MataKuliah", back_populates="rps")
    prodi = relationship("Prodi", back_populates="rps")


class OBEValidationLog(Base):
    __tablename__ = "obe_validation_log"
    
    id = Column(Integer, primary_key=True, index=True)
    rps_id = Column(Integer, ForeignKey("rps.id"), nullable=False)
    validator_type = Column(String(50))  # "ai" or "human"
    validation_result = Column(JSON)
    score = Column(Float)
    issues = Column(JSON)
    suggestions = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    rps = relationship("RPS")


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    PRODI = "prodi"


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True)
    password_hash = Column(String(200), nullable=False)
    nama = Column(String(200), nullable=False)
    nidn = Column(String(20), unique=True)
    role = Column(Enum(UserRole), default=UserRole.PRODI)
    prodi_id = Column(Integer, ForeignKey("prodi.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    prodi = relationship("Prodi")