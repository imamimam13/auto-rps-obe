RPS_GENERATION_SYSTEM_PROMPT = """Anda adalah asisten AI ahli dalam pengembangan kurikulum Pendidikan Tinggi berbasis Outcome-Based Education (OBE) di Indonesia. 
Anda memahami:
- Standar Nasional Pendidikan Tinggi (SN-Dikti) Indonesia
- Kerangka Kualifikasi Nasional Indonesia (KKNI)
- Konsep OBE (Outcome-Based Education) 
- Penyusunan RPS (Rencana Pembelajaran Semester) yang sesuai Permendikbudristek
- Hubungan CPL (Capaian Pembelajaran Lulusan) → CPMK (Capaian Pembelajaran Mata Kuliah) → Sub-CPMK
- Taksonomi Bloom (kognitif, afektif, psikomotorik)

Anda wajib selalu memberikan output HANYA dalam format JSON valid yang terstruktur. Jangan menuliskan penjelasan pembuka atau penutup. Output Anda harus dimulai dengan '{' dan diakhiri dengan '}'.
Gunakan Bahasa Indonesia yang baik dan benar dalam semua deskripsi."""  # noqa: E501


RPS_GENERATION_PROMPT = """Anda adalah ahli kurikulum pendidikan tinggi. Buatkan RPS (Rencana Pembelajaran Semester) lengkap dan detail untuk satu mata kuliah berdasarkan informasi berikut:

VISI PRODI:
{visi_prodi}

MISI PRODI:
{misi_prodi}

CPL (Capaian Pembelajaran Lulusan) Prodi:
{cpl_prodi}

MATA KULIAH:
- Nama: {nama_mata_kuliah}
- Kode: {kode_mata_kuliah}
- SKS: {sks} (Teori: {sks_teori}, Praktik: {sks_praktik})
- Deskripsi: {deskripsi_mata_kuliah}
- Semester: {semester}
- Tahun Akademik: {tahun_akademik}

INFORMASI TAMBAHAN:
{additional_context}

Buat RPS lengkap dengan format JSON berikut. Pastikan konten relevan dengan visi misi prodi dan CPL yang diberikan:

{{
  "identitas": {{
    "nama_mata_kuliah": "{nama_mata_kuliah}",
    "kode_mata_kuliah": "{kode_mata_kuliah}", 
    "sks": {sks},
    "semester": {semester},
    "prodi": "nama prodi",
    "fakultas": "nama fakultas",
    "tanggal_penyusunan": "Tanggal hari ini",
    "no_dokumen": "No dokumen/RPS",
    "koordinator_pengembang_rps": "Nama Dosen/Koordinator Pengembang",
    "koordinator_rmk": "Nama Koordinator Rumpun MK",
    "ka_prodi": "Nama Ketua Program Studi"
  }},
  "deskripsi_mata_kuliah": "deskripsi lengkap sesuai CPL",
  "bahan_kajian": [
    "Bahan kajian / Pokok Bahasan 1...",
    "Bahan kajian / Pokok Bahasan 2..."
  ],
  "cpmk": [
    {{
      "kode": "CPMK1",
      "deskripsi": "...", 
      "bobot": 0.20,
      "cpl_prodi": ["kode_cpl_yang_relevan"],
      "taksonomi_bloom": "C3/A2/P2"
    }}
  ],
  "sub_cpmk": [
    {{
      "kode": "Sub-CPMK 1",
      "cpmk_kode": "CPMK1",
      "deskripsi": "...",
      "indikator": ["indikator 1", "indikator 2"]
    }}
  ],
  "rencana_pembelajaran": [
    {{
      "minggu_ke": 1,
      "sub_cpmk_kode": "Sub-CPMK 1",
      "sub_cpmk_deskripsi": "deskripsi Sub-CPMK / kemampuan akhir yg diharapkan",
      "materi": "Materi Pembelajaran yang diajarkan",
      "metode": "Bentuk: Kuliah, Metode: Diskusi interaktif / Problem Based Learning",
      "estimasi_waktu": "TM: 1x3x50' BT: 1x3x60' BM: 1x3x60'",
      "pengalaman_belajar": "Membaca materi, diskusi kelompok, presentasi mandiri",
      "kriteria_penilaian": "Kriteria: Rubrik. Bentuk non-test: Ringkasan/Makalah/Kuis",
      "indikator": "Ketepatan menjelaskan teori...",
      "bobot": 5
    }}
  ],
  "media_pembelajaran": {{
    "perangkat_lunak": ["Microsoft Power Point", "Google Classroom", "Zoom"],
    "perangkat_keras": ["LCD & Projector", "Whiteboard", "Notebook"]
  }},
  "penilaian": [
    {{
      "komponen": "Tugas Individu",
      "bobot": 0.20,
      "jenis": "tugas",
      "kriteria": ["kriteria 1", "kriteria 2"],
      "sub_cpmk_kode": ["Sub-CPMK 1"]
    }}
  ],
  "referensi": {{
    "utama": [
      "Nama Pengarang. Tahun. Judul Buku. Kota: Penerbit."
    ],
    "pendukung": [
      "Nama Pengarang. Tahun. Judul Buku Rujukan. Kota: Penerbit."
    ]
  }}
}}

Pastikan:
1. CPMK relevan dengan CPL Prodi dan visi misi
2. Sub-CPMK mendukung CPMK dengan indikator terukur
3. Rencana pembelajaran 16 minggu (termasuk UTS & UAS)
4. Metode pembelajaran bervariasi dan student-centered
5. Penilaian mencakup semua Sub-CPMK
6. Bobot penilaian total = 1.0
7. Gunakan taksonomi Bloom yang sesuai
8. PENTING: Nilai dalam array "cpl_prodi" pada objek CPMK harus persis sama dan HANYA menggunakan kode dari daftar "CPL (Capaian Pembelajaran Lulusan) Prodi" yang diberikan di atas (misalnya: CPL-01, CPL-02, dst.). Dilarang keras mengarang kode CPL baru."""  # noqa: E501


CPMK_GENERATION_PROMPT = """Berdasarkan informasi berikut, buatlah CPMK (Capaian Pembelajaran Mata Kuliah) yang sesuai:

VISI PRODI: {visi_prodi}
MISI PRODI: {misi_prodi}
CPL PRODI: {cpl_prodi}

MATA KULIAH: {nama_mk}
DESKRIPSI: {deskripsi_mk}

Buat 4-8 CPMK yang relevan. Output format JSON:
{{
  "cpmk": [
    {{
      "kode": "CPMK01",
      "deskripsi": "...",
      "bobot": 0.0,
      "cpl_prodi": ["kode_cpl"],
      "taksonomi_bloom": "C3"
    }}
  ]
}}

Bobot total harus 1.0. Gunakan taksonomi Bloom (C1-C6, A1-A5, P1-P4).
PENTING: Nilai dalam array "cpl_prodi" harus persis sama dan HANYA menggunakan kode dari daftar CPL PRODI yang diberikan di atas (misalnya CPL-1, CPL-2, dst.). Dilarang keras mengarang kode CPL baru."""  # noqa: E501


SUB_CPMK_GENERATION_PROMPT = """Berdasarkan CPMK berikut, buat Sub-CPMK untuk setiap CPMK:

CPMK:
{cpmk}

MATA KULIAH: {nama_mk}

Output format JSON:
{{
  "sub_cpmk": [
    {{
      "kode": "SUB-01",
      "cpmk_kode": "CPMK01",
      "deskripsi": "...",
      "indikator": ["indikator 1", "indikator 2"]
    }}
  ]
}}

Setiap CPMK minimal 2 Sub-CPMK. Indikator harus terukur dan spesifik."""  # noqa: E501


RENCANA_MINGGUAN_PROMPT = """Buat rencana pembelajaran mingguan (16 pertemuan) berdasarkan:

CPMK: {cpmk}
SUB-CPMK: {sub_cpmk}
SKS: {sks}

Output format JSON:
{{
  "rencana_pembelajaran": [
    {{
      "minggu_ke": 1,
      "sub_cpmk_kode": "SUB-01",
      "materi": "...",
      "metode": ["...", "..."],
      "media": ["...", "..."],
      "durasi": 150,
      "tugas": "...",
      "penilaian": "..."
    }}
  ]
}}

16 minggu, setiap minggu 150 menit (3 SKS). Variasikan metode setiap minggu.
Minggu ke-8: UTS, Minggu ke-16: UAS."""  # noqa: E501


PENILAIAN_GENERATION_PROMPT = """Buat sistem penilaian berdasarkan:

CPMK: {cpmk}
SUB-CPMK: {sub_cpmk}

Output format JSON:
{{
  "penilaian": [
    {{
      "komponen": "...",
      "bobot": 0.0,
      "jenis": "tugas/uts/uas/kehadiran",
      "kriteria": ["..."],
      "sub_cpmk_kode": ["SUB-01"]
    }}
  ]
}}

Bobot total = 1.0. Komponen minimal: Tugas, UTS, UAS."""  # noqa: E501


RPS_REVIEW_PROMPT = """Review RPS berikut dan berikan saran perbaikan:

DATA RPS:
{rps_data}

Berikan review komprehensif yang mencakup:
1. Kesesuaian dengan visi misi prodi
2. Kualitas CPMK dan Sub-CPMK
3. Kesesuaian metode pembelajaran
4. Kualitas sistem penilaian
5. Saran perbaikan

Output format JSON:
{{
  "review": {{
    "nilai_keseluruhan": 0,
    "kelebihan": ["...", "..."],
    "kekurangan": ["...", "..."],
    "saran_perbaikan": [
      {{"bagian": "...", "saran": "..."}}
    ]
  }}
}}"""  # noqa: E501


RPS_IMPROVE_PROMPT = """Perbaiki RPS berikut berdasarkan feedback yang diberikan:

RPS DATA:
{rps_data}

FEEDBACK:
{feedback}

Output dalam format JSON yang sama dengan struktur RPS di atas.
Tingkatkan kualitas berdasarkan feedback yang diberikan."""  # noqa: E501


OBE_VALIDATION_SYSTEM_PROMPT = """Anda adalah auditor OBE (Outcome-Based Education) untuk pendidikan tinggi Indonesia. 
Tugas Anda adalah memvalidasi RPS berdasarkan prinsip OBE:
1. Alignment CPL → CPMK → Sub-CPMK → Kegiatan Pembelajaran → Penilaian
2. Constructive alignment (keselarasan konstruktif)
3. Assessment berbasis kompetensi
4. Student-centered learning
5. Continuous quality improvement

Berikan skor validasi, identifikasi masalah, dan berikan saran perbaikan."""  # noqa: E501


OBE_VALIDATION_PROMPT = """Validasi RPS berikut berdasarkan prinsip OBE:

DATA RPS:
{rps_data}

Output format JSON:
{{
  "validated": true/false,
  "score": 0.0,
  "issues": [
    {{
      "severity": "high/medium/low",
      "bagian": "cpmk/penilaian/dll",
      "deskripsi": "...",
      "saran": "..."
    }}
  ],
  "suggestions": [
    {{
      "bagian": "...",
      "rekomendasi": "...",
      "prioritas": "high/medium/low"
    }}
  ],
  "details": {{
    "alignment_score": 0.0,
    "assessment_quality": 0.0,
    "learning_method_variety": 0.0,
    "cpmk_quality": 0.0,
    "completeness": 0.0
  }}
}}

Skor 0-100. Issues minimal 3 jika ada masalah. Berikan saran yang actionable."""  # noqa: E501