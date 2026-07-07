# Auto RPS & OBE AI

Aplikasi berbasis AI untuk menyusun Rencana Pembelajaran Semester (RPS) dan validasi Outcome-Based Education (OBE) secara otomatis. 

Didesain dengan gaya macOS - clean, minimal, frosted glass.

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
| Database | PostgreSQL |
| Cache | Redis |

## Instalasi di macOS

### Prasyarat

Sebelum memulai, pastikan sistem Anda sudah memiliki:

1. **Xcode Command Line Tools**
   ```bash
   xcode-select --install
   ```

2. **Homebrew** (jika belum ada)
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

### 1. Install Ollama (AI Lokal)

```bash
# Install Ollama
brew install ollama

# Download model Llama 3.1 (8B)
ollama pull llama3.1:8b

# Jalankan Ollama (di background)
ollama serve &
```

Verifikasi Ollama berjalan:
```bash
curl http://localhost:11434/api/tags
```

### 2. Clone & Setup Project

```bash
# Clone repository
git clone https://github.com/[username]/auto-rps-obe.git
cd auto-rps-obe
```

### 3. Setup Backend

```bash
# Masuk ke direktori backend
cd backend

# Buat virtual environment
python3 -m venv venv

# Aktivasi virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Jalankan backend
uvicorn app.main:app --reload
```

Backend akan berjalan di `http://localhost:8000`
Dokumentasi API: `http://localhost:8000/docs`

### 4. Setup Frontend

Buka terminal baru:

```bash
# Masuk ke direktori frontend
cd frontend

# Install dependencies
npm install

# Jalankan frontend
npm run dev
```

Frontend akan berjalan di `http://localhost:5173`

### 5. Setup Database (Opsional - untuk production)

Jika ingin menggunakan database PostgreSQL:

```bash
# Install PostgreSQL
brew install postgresql@16

# Jalankan PostgreSQL
brew services start postgresql@16

# Buat database
createdb autorps
```

Atau gunakan Docker untuk database:

```bash
# Jalankan PostgreSQL + Redis via Docker
docker compose up db redis -d
```

### Installasi Lengkap (Satu Perintah)

```bash
# Install dependencies
brew install ollama python@3.12 node postgresql@16
ollama pull llama3.1:8b
ollama serve &

# Setup backend
cd backend
python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt
uvicorn app.main:app --reload &

# Setup frontend
cd ../frontend
npm install && npm run dev
```

## Docker Deployment

```bash
# Jalankan semua service
docker compose up --build

# Atau jalankan di background
docker compose up -d
```

Akses:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- API Docs: `http://localhost:8000/docs`

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

## Lisensi

MIT License

Copyright (c) 2025

---

Dibuat dengan ❤️ untuk pendidikan Indonesia
