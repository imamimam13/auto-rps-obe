# Auto RPS & OBE AI

Aplikasi berbasis AI untuk menyusun Rencana Pembelajaran Semester (RPS) dan validasi Outcome-Based Education (OBE) secara otomatis. 

Didesain dengan gaya macOS - clean, minimal, frosted glass.

## Instalasi (1 Perintah)

**Semua platform:**
```bash
bash <(curl -sL https://raw.githubusercontent.com/imamimam13/auto-rps-obe/main/install.sh)
```

**Casa OS:**
```bash
bash <(curl -sL https://raw.githubusercontent.com/imamimam13/auto-rps-obe/main/casaos-app/install.sh)
```

Tunggu selesai, buka **http://localhost:9811**

> Port: Backend `9810` · Frontend `9811`  
> Bisa diubah: `BACKEND_PORT=9820 FRONTEND_PORT=9821 bash install.sh`  
> Ollama opsional - AI features tetap jalan kalau sudah terinstall.

## Fitur

- **Generate RPS dengan AI** - Masukkan visi misi prodi, AI menyusun RPS lengkap 16 minggu
- **CPMK & Sub-CPMK Otomatis** - Mapping dari CPL Prodi ke CPMK dan Sub-CPMK
- **Validasi OBE** - Periksa keselarasan CPL → CPMK → Sub-CPMK → Penilaian
- **Export PDF & DOCX** - Download RPS siap cetak/editar
- **Manajemen Prodi & Mata Kuliah** - CRUD data program studi dan mata kuliah

## Tech Stack

| Komponen | Teknologi |
|----------|-----------|
| Backend | Python FastAPI |
| Frontend | React + Vite + TypeScript |
| Styling | Tailwind CSS (macOS design) |
| AI Engine | Ollama (Llama 3.1) - Local LLM |
| Database | SQLite (default) / PostgreSQL |

## Struktur API

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/v1/prodi/` | List program studi |
| POST | `/api/v1/prodi/` | Tambah prodi |
| GET | `/api/v1/mata-kuliah/` | List mata kuliah |
| POST | `/api/v1/mata-kuliah/` | Tambah mata kuliah |
| GET | `/api/v1/rps/` | List RPS |
| POST | `/api/v1/rps/` | Buat RPS |
| POST | `/api/v1/generate/rps` | Generate RPS dengan AI |
| POST | `/api/v1/generate/validate-obe` | Validasi OBE |
| POST | `/api/v1/export/{id}` | Export RPS (PDF/DOCX) |
| GET | `/api/v1/ollama/status` | Cek status Ollama |

## Panduan Penggunaan

### 1. Tambah Program Studi
- Buka halaman **Program Studi**
- Klik "Tambah Prodi"
- Isi visi, misi, dan data prodi

### 2. Tambah Mata Kuliah
- Buka halaman **Mata Kuliah**
- Klik "Tambah Mata Kuliah"  
- Hubungkan dengan prodi yang sudah dibuat

### 3. Generate RPS
- Buka detail mata kuliah
- Klik "Generate RPS"
- Isi semester, tahun akademik, dan dosen pengampu
- Klik "Generate RPS dengan AI"
- Review hasil dan simpan

### 4. Validasi OBE
- Buka halaman **Validasi OBE**
- Pilih RPS yang sudah dibuat
- Klik "Validasi OBE"
- Lihat skor dan saran perbaikan

### 5. Export
- Di halaman detail RPS, klik "PDF" atau "DOCX"
- File akan terdownload otomatis

## Lisensi

MIT License

Copyright (c) 2025

---

Dibuat dengan ❤️ untuk pendidikan Indonesia
