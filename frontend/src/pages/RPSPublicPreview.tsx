import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, FileText, Sparkles, BookOpen, GraduationCap, CheckCircle } from 'lucide-react'
import api from '@/services/api'

interface RPS {
  id: number
  kode: string
  mata_kuliah_id: number
  prodi_id: number
  semester: number
  tahun_akademik: string
  dosen_pengampu?: { nama: string; nidn: string }[]
  identitas?: {
    nama_mata_kuliah: string
    kode_mata_kuliah: string
    sks: number
    semester: number
    prodi: string
    fakultas: string
    tanggal_penyusunan?: string
    no_dokumen?: string
    koordinator_pengembang_rps?: string
    koordinator_rmk?: string
    ka_prodi?: string
  }
  deskripsi_mata_kuliah?: string
  bahan_kajian?: string[] | string
  cpmk?: { kode: string; deskripsi: string; bobot: number; cpl_prodi: string[] }[]
  sub_cpmk?: { kode: string; cpmk_kode: string; deskripsi: string; indikator: string[] }[]
  rencana_pembelajaran?: {
    minggu_ke: number
    sub_cpmk_kode: string
    sub_cpmk_deskripsi?: string
    materi: string
    metode: string | string[]
    estimasi_waktu?: string
    durasi?: string | number
    pengalaman_belajar?: string
    kriteria_penilaian?: string
    bobot?: number
  }[]
  media_pembelajaran?: {
    perangkat_lunak?: string[] | string
    perangkat_keras?: string[] | string
  } | string[] | any
  penilaian?: { komponen: string; bobot: number; jenis: string }[]
  referensi?: {
    utama?: string[] | string
    pendukung?: string[] | string
  } | string[] | any
}

export default function RPSPublicPreview() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [rps, setRps] = useState<RPS | null>(null)
  const [loading, setLoading] = useState(true)
  const [campusName, setCampusName] = useState('SEKOLAH TINGGI ILMU EKONOMI WIRA BHAKTI')
  const [campusLogo, setCampusLogo] = useState('')

  useEffect(() => {
    fetchRPSDetail()
  }, [id])

  async function fetchRPSDetail() {
    try {
      setLoading(true)
      // Load branding
      try {
        const brandRes = await api.get('/api/v1/ollama/branding')
        if (brandRes.data.brand_campus_name) {
          setCampusName(brandRes.data.brand_campus_name)
        }
        if (brandRes.data.brand_campus_logo_url) {
          setCampusLogo(brandRes.data.brand_campus_logo_url)
        }
      } catch {
        // use default
      }

      const res = await api.get(`/api/v1/rps/${id}`)
      setRps(res.data)
    } catch (e) {
      console.error('Failed to load RPS details', e)
    } finally {
      setLoading(false)
    }
  }

  function handleDownload(format: 'pdf' | 'docx') {
    if (!rps) return
    const url = `${api.defaults.baseURL}/api/v1/export/${rps.id}?export_format=${format}`
    window.open(url, '_blank')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-3 border-macos-blue border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-gray-500 font-medium">Memuat pratinjau dokumen...</p>
      </div>
    )
  }

  if (!rps) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex flex-col items-center justify-center p-6 text-center">
        <FileText className="w-16 h-16 text-gray-300 mb-4" />
        <h3 className="text-lg font-bold text-gray-900">RPS Tidak Ditemukan</h3>
        <p className="text-sm text-gray-500 mt-1 max-w-sm">Dokumen yang Anda cari tidak tersedia atau telah dihapus.</p>
        <button
          onClick={() => navigate('/')}
          className="mt-6 text-xs font-semibold bg-gray-900 hover:bg-gray-800 text-white px-4 py-2.5 rounded-apple-lg shadow-sm"
        >
          Kembali ke Direktori
        </button>
      </div>
    )
  }

  // Formatting helpers for references and media
  const refUtama = Array.isArray(rps.referensi?.utama)
    ? rps.referensi.utama
    : typeof rps.referensi?.utama === 'string' && rps.referensi.utama
    ? [rps.referensi.utama]
    : Array.isArray(rps.referensi)
    ? rps.referensi
    : []

  const refPendukung = Array.isArray(rps.referensi?.pendukung)
    ? rps.referensi.pendukung
    : typeof rps.referensi?.pendukung === 'string'
    ? [rps.referensi.pendukung]
    : []

  const mediaSoft = Array.isArray(rps.media_pembelajaran?.perangkat_lunak)
    ? rps.media_pembelajaran.perangkat_lunak
    : typeof rps.media_pembelajaran?.perangkat_lunak === 'string'
    ? [rps.media_pembelajaran.perangkat_lunak]
    : Array.isArray(rps.media_pembelajaran)
    ? rps.media_pembelajaran
    : []

  const mediaHard = Array.isArray(rps.media_pembelajaran?.perangkat_keras)
    ? rps.media_pembelajaran.perangkat_keras
    : typeof rps.media_pembelajaran?.perangkat_keras === 'string'
    ? [rps.media_pembelajaran.perangkat_keras]
    : []

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-900 font-sans pb-20">
      {/* Sticky Action bar */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 px-6 py-4 flex items-center justify-between shadow-sm">
        <button
          onClick={() => navigate('/')}
          className="text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-apple-lg border border-gray-200 transition-all flex items-center gap-1.5 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Direktori RPS
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDownload('pdf')}
            className="text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 px-3.5 py-2 rounded-apple-lg transition-all flex items-center gap-1.5 border border-red-100 shadow-sm"
          >
            <Download className="w-4 h-4" />
            Unduh PDF
          </button>
          <button
            onClick={() => handleDownload('docx')}
            className="text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 px-3.5 py-2 rounded-apple-lg transition-all flex items-center gap-1.5 border border-blue-100 shadow-sm"
          >
            <Download className="w-4 h-4" />
            Unduh Word
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 mt-8 space-y-6">
        {/* Visual Kop Surat */}
        <div className="bg-white rounded-apple-xl border border-gray-100 p-6 shadow-sm flex items-center gap-6">
          {campusLogo ? (
            <img src={campusLogo} alt="Logo Perguruan Tinggi" className="w-16 h-16 object-contain" />
          ) : (
            <div className="w-16 h-16 rounded-apple-2xl bg-gradient-to-br from-macos-blue to-purple-500 flex items-center justify-center shadow-sm">
              <Sparkles className="w-9 h-9 text-white" />
            </div>
          )}
          <div className="flex-1">
            <h2 className="text-xs font-bold tracking-wider text-macos-blue uppercase">Rencana Pembelajaran Semester (RPS)</h2>
            <h1 className="text-lg font-bold text-gray-900 mt-0.5">{rps.identitas?.nama_mata_kuliah}</h1>
            <p className="text-xs text-gray-500 font-medium mt-1 font-mono">
              Fakultas / Program Studi: {rps.identitas?.fakultas || '-'} / {rps.identitas?.prodi || '-'}
            </p>
          </div>
        </div>

        {/* Identitas Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-apple-xl border border-gray-100 p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold tracking-wider text-gray-400 uppercase">Informasi Kurikulum</h3>
            <div className="text-xs space-y-2 text-gray-600">
              <div className="flex justify-between border-b border-gray-50 pb-1">
                <span>Kode Mata Kuliah</span>
                <span className="font-semibold text-gray-900 font-mono">{rps.identitas?.kode_mata_kuliah}</span>
              </div>
              <div className="flex justify-between border-b border-gray-50 pb-1">
                <span>Bobot Kredit (SKS)</span>
                <span className="font-semibold text-gray-900">{rps.identitas?.sks} SKS</span>
              </div>
              <div className="flex justify-between border-b border-gray-50 pb-1">
                <span>Semester / Kelas</span>
                <span className="font-semibold text-gray-900">Semester {rps.semester}</span>
              </div>
              <div className="flex justify-between">
                <span>Tahun Akademik</span>
                <span className="font-semibold text-gray-900 font-mono">{rps.tahun_akademik}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-apple-xl border border-gray-100 p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold tracking-wider text-gray-400 uppercase">Dosen Pengampu</h3>
            <div className="text-xs space-y-2 text-gray-700">
              {rps.dosen_pengampu && rps.dosen_pengampu.length > 0 ? (
                rps.dosen_pengampu.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 px-2.5 py-1.5 rounded-apple-md">
                    <div className="w-5 h-5 rounded-full bg-macos-blue/10 text-macos-blue font-bold flex items-center justify-center text-[10px]">
                      {d.nama.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold">{d.nama}</p>
                      <p className="text-[10px] text-gray-400 font-mono">NIDN: {d.nidn || '-'}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 italic">Dosen Pengampu belum diisi.</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-apple-xl border border-gray-100 p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold tracking-wider text-gray-400 uppercase">Dokumentasi & Otorisasi</h3>
            <div className="text-xs space-y-2 text-gray-600">
              <div className="flex justify-between border-b border-gray-50 pb-1">
                <span>No. Dokumen</span>
                <span className="font-semibold text-gray-900 font-mono">{rps.identitas?.no_dokumen || '-'}</span>
              </div>
              <div className="flex justify-between border-b border-gray-50 pb-1">
                <span>Tanggal Penyusunan</span>
                <span className="font-semibold text-gray-900">{rps.identitas?.tanggal_penyusunan || '-'}</span>
              </div>
              <div className="flex justify-between border-b border-gray-50 pb-1">
                <span>Koordinator RMK</span>
                <span className="font-semibold text-gray-900">{rps.identitas?.koordinator_rmk || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span>Ka. Program Studi</span>
                <span className="font-semibold text-gray-900">{rps.identitas?.ka_prodi || '-'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Deskripsi & Bahan Kajian */}
        {(rps.deskripsi_mata_kuliah || (rps.bahan_kajian && rps.bahan_kajian.length > 0)) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {rps.deskripsi_mata_kuliah && (
              <div className="bg-white rounded-apple-xl border border-gray-100 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-macos-blue" />
                  Deskripsi Singkat Mata Kuliah
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed text-justify">{rps.deskripsi_mata_kuliah}</p>
              </div>
            )}
            {rps.bahan_kajian && rps.bahan_kajian.length > 0 && (
              <div className="bg-white rounded-apple-xl border border-gray-100 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-macos-blue" />
                  Bahan Kajian / Pokok Bahasan
                </h3>
                {Array.isArray(rps.bahan_kajian) ? (
                  <ul className="list-disc pl-5 space-y-1.5 text-sm text-gray-600">
                    {rps.bahan_kajian.map((bk, idx) => (
                      <li key={idx} className="leading-relaxed">{bk}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-600 leading-relaxed text-justify">{rps.bahan_kajian}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* CPMK */}
        {rps.cpmk && rps.cpmk.length > 0 && (
          <div className="bg-white rounded-apple-xl border border-gray-100 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <CheckCircle className="w-4.5 h-4.5 text-macos-blue" />
              Capaian Pembelajaran Mata Kuliah (CPMK)
            </h3>
            <div className="space-y-2">
              {rps.cpmk.map((c, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-gray-50/50 rounded-apple-lg border border-gray-100/50">
                  <span className="text-xs font-mono font-bold text-macos-blue bg-blue-50 px-2 py-0.5 rounded shrink-0">{c.kode}</span>
                  <div className="flex-1">
                    <p className="text-sm text-gray-700 font-medium">{c.deskripsi}</p>
                    <p className="text-[10px] text-gray-400 mt-1">CPL yang Didukung: {c.cpl_prodi?.join(', ') || '-'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rencana Kegiatan Pembelajaran Table (8 Columns) */}
        {rps.rencana_pembelajaran && rps.rencana_pembelajaran.length > 0 && (
          <div className="bg-white rounded-apple-xl border border-gray-100 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Rencana Kegiatan Pembelajaran Mingguan</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50">
                    <th className="text-center py-2 px-3 text-gray-500 font-medium w-[6%]">Minggu</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-medium w-[22%]">Sub-CPMK</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-medium w-[22%]">Materi Pembelajaran</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-medium w-[15%]">Bentuk & Metode</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-medium w-[12%]">Estimasi Waktu</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-medium w-[12%]">Pengalaman Belajar</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-medium w-[12%]">Kriteria Penilaian</th>
                    <th className="text-center py-2 px-3 text-gray-500 font-medium w-[7%]">Bobot (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {rps.rencana_pembelajaran.map((r) => (
                    <tr key={r.minggu_ke} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="py-2.5 px-3 font-mono text-center font-semibold">{r.minggu_ke}</td>
                      <td className="py-2.5 px-3 text-gray-900">
                        <strong>{r.sub_cpmk_kode}</strong>
                        {r.sub_cpmk_deskripsi && <span className="block text-gray-400 font-normal mt-0.5">{r.sub_cpmk_deskripsi}</span>}
                      </td>
                      <td className="py-2.5 px-3 text-gray-700">{r.materi}</td>
                      <td className="py-2.5 px-3 text-gray-600">{typeof r.metode === 'object' ? (r.metode as string[])?.join(', ') : r.metode}</td>
                      <td className="py-2.5 px-3 text-gray-500 font-mono">{r.estimasi_waktu || r.durasi}</td>
                      <td className="py-2.5 px-3 text-gray-500">{r.pengalaman_belajar || '-'}</td>
                      <td className="py-2.5 px-3 text-gray-500">{r.kriteria_penilaian || '-'}</td>
                      <td className="py-2.5 px-3 text-center font-medium text-gray-900">{r.bobot || 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Media & Penilaian & Referensi */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Media */}
          <div className="bg-white rounded-apple-xl border border-gray-100 p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Media Pembelajaran</h3>
            <div className="text-xs space-y-3 text-gray-600">
              <div>
                <p className="font-semibold text-gray-700">Perangkat Lunak (Software):</p>
                {mediaSoft.length > 0 ? (
                  <ul className="list-disc pl-4 mt-1 space-y-1">
                    {mediaSoft.map((s: string, idx: number) => <li key={idx}>{s}</li>)}
                  </ul>
                ) : <p className="text-gray-400 mt-1">-</p>}
              </div>
              <div>
                <p className="font-semibold text-gray-700">Perangkat Keras (Hardware):</p>
                {mediaHard.length > 0 ? (
                  <ul className="list-disc pl-4 mt-1 space-y-1">
                    {mediaHard.map((h: string, idx: number) => <li key={idx}>{h}</li>)}
                  </ul>
                ) : <p className="text-gray-400 mt-1">-</p>}
              </div>
            </div>
          </div>

          {/* Penilaian */}
          <div className="bg-white rounded-apple-xl border border-gray-100 p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Evaluasi & Penilaian</h3>
            <div className="text-xs space-y-2">
              {rps.penilaian && rps.penilaian.length > 0 ? (
                rps.penilaian.map((p, i) => (
                  <div key={i} className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded-apple-md">
                    <span className="font-medium text-gray-800">{p.komponen}</span>
                    <span className="font-semibold text-macos-blue">{(p.bobot * 100).toFixed(0)}%</span>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 italic">Data penilaian kosong.</p>
              )}
            </div>
          </div>

          {/* Referensi */}
          <div className="bg-white rounded-apple-xl border border-gray-100 p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Daftar Referensi</h3>
            <div className="text-xs space-y-3 text-gray-600">
              <div>
                <p className="font-semibold text-gray-700">Referensi Utama:</p>
                {refUtama.length > 0 ? (
                  <ol className="list-decimal pl-4 mt-1 space-y-1">
                    {refUtama.map((r: string, idx: number) => <li key={idx}>{r}</li>)}
                  </ol>
                ) : <p className="text-gray-400 mt-1">-</p>}
              </div>
              <div>
                <p className="font-semibold text-gray-700">Referensi Pendukung:</p>
                {refPendukung.length > 0 ? (
                  <ol className="list-decimal pl-4 mt-1 space-y-1">
                    {refPendukung.map((r: string, idx: number) => <li key={idx}>{r}</li>)}
                  </ol>
                ) : <p className="text-gray-400 mt-1">-</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
