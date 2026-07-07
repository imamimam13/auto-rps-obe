import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Sparkles, Loader2, BookOpen, FileText, CheckSquare, ChevronDown, ChevronUp } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'

interface CPMK {
  kode: string
  deskripsi: string
  bobot: number
  cpl_prodi: string[]
  taksonomi_bloom: string
}

interface SubCPMK {
  kode: string
  cpmk_kode: string
  deskripsi: string
  indikator: string[]
}

interface RencanaMingguan {
  minggu_ke: number
  sub_cpmk_kode: string
  materi: string
  metode: string[]
  media: string[]
  durasi: number
  tugas?: string
}

interface Penilaian {
  komponen: string
  bobot: number
  jenis: string
  kriteria: string[]
  sub_cpmk_kode: string[]
}

interface RPSData {
  identitas: any
  deskripsi_mata_kuliah: string
  cpmk: CPMK[]
  sub_cpmk: SubCPMK[]
  rencana_pembelajaran: RencanaMingguan[]
  metode_pembelajaran: string[]
  media_pembelajaran: string[]
  penilaian: Penilaian[]
  referensi: any[]
}

export default function RPSGenerate() {
  const { mkId } = useParams()
  const navigate = useNavigate()
  const [mk, setMk] = useState<any>(null)
  const [prodi, setProdi] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [expandedSection, setExpandedSection] = useState<string | null>('cpmk')
  const [rpsData, setRpsData] = useState<RPSData | null>(null)
  const [formData, setFormData] = useState({
    semester: 1,
    tahun_akademik: '2025/2026',
    dosen_pengampu: [] as { nama: string; nidn: string }[],
    additional_context: '',
  })
  const [dosenInput, setDosenInput] = useState({ nama: '', nidn: '' })

  useEffect(() => {
    if (mkId && mkId !== 'new') loadMk()
    else setLoading(false)
  }, [mkId])

  async function loadMk() {
    try {
      const res = await api.get(`/api/v1/mata-kuliah/${mkId}`)
      setMk(res.data)
      setFormData(f => ({ ...f, semester: res.data.semester || 1 }))
      if (res.data.prodi_id) {
        const pRes = await api.get(`/api/v1/prodi/${res.data.prodi_id}`)
        setProdi(pRes.data)
      }
    } catch (e) {
      toast.error('Gagal memuat data mata kuliah')
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerate() {
    if (!mk || !prodi) {
      toast.error('Data mata kuliah atau prodi tidak ditemukan')
      return
    }
    if (formData.dosen_pengampu.length === 0) {
      toast.error('Tambahkan minimal 1 dosen pengampu')
      return
    }
    setGenerating(true)
    try {
      const res = await api.post('/api/v1/generate/rps', {
        mata_kuliah_id: mk.id,
        prodi_id: prodi.id,
        semester: formData.semester,
        tahun_akademik: formData.tahun_akademik,
        dosen_pengampu: formData.dosen_pengampu,
        additional_context: formData.additional_context,
      })
      setRpsData(res.data.data)
      setShowPreview(true)
      toast.success('RPS berhasil di-generate!')
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Gagal generate RPS')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    if (!rpsData || !mk || !prodi) return
    try {
      const res = await api.post('/api/v1/rps/', {
        mata_kuliah_id: mk.id,
        prodi_id: prodi.id,
        semester: formData.semester,
        tahun_akademik: formData.tahun_akademik,
        dosen_pengampu: formData.dosen_pengampu,
        identitas: {
          ...rpsData.identitas,
          dosen_pengampu: formData.dosen_pengampu,
        },
        cpmk: rpsData.cpmk,
        sub_cpmk: rpsData.sub_cpmk,
        rencana_pembelajaran: rpsData.rencana_pembelajaran,
        metode_pembelajaran: rpsData.metode_pembelajaran,
        media_pembelajaran: rpsData.media_pembelajaran,
        penilaian: rpsData.penilaian,
        referensi: rpsData.referensi,
      })
      toast.success('RPS berhasil disimpan!')
      navigate(`/rps/${res.data.id}`)
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Gagal menyimpan RPS')
    }
  }

  function addDosen() {
    if (!dosenInput.nama) return
    setFormData(f => ({
      ...f,
      dosen_pengampu: [...f.dosen_pengampu, { ...dosenInput }],
    }))
    setDosenInput({ nama: '', nidn: '' })
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Memuat...</div>
  if (!mk) {
    return (
      <div className="space-y-5 animate-fade-in">
        <h1 className="text-2xl font-semibold text-gray-900">Generate RPS Baru</h1>
        <p className="text-gray-500">Pilih mata kuliah dari halaman Mata Kuliah untuk memulai.</p>
        <Link to="/mata-kuliah" className="macos-button inline-flex items-center gap-2"><BookOpen className="w-4 h-4" /> Lihat Mata Kuliah</Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <Link to={`/mata-kuliah/${mk.id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-macos-blue transition-colors">
        <ArrowLeft className="w-4 h-4" /> Kembali ke {mk.nama}
      </Link>

      <div className="macos-card p-6">
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-apple-xl bg-gradient-to-br from-purple-500 to-pink-500">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Generate RPS dengan AI</h1>
            <p className="text-sm text-gray-500">{mk.nama} ({mk.kode}) · {prodi?.nama}</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="grid grid-cols-2 gap-4">
        <div className="macos-card p-5">
          <label className="macos-label">Semester</label>
          <input type="number" className="macos-input" value={formData.semester} onChange={(e) => setFormData({ ...formData, semester: Number(e.target.value) })} min={1} max={14} />
        </div>
        <div className="macos-card p-5">
          <label className="macos-label">Tahun Akademik</label>
          <input className="macos-input" value={formData.tahun_akademik} onChange={(e) => setFormData({ ...formData, tahun_akademik: e.target.value })} placeholder="2025/2026" />
        </div>
      </div>

      {/* Dosen */}
      <div className="macos-card p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Dosen Pengampu</h3>
        <div className="flex items-end gap-3 mb-3">
          <div className="flex-1">
            <label className="macos-label">Nama</label>
            <input className="macos-input" value={dosenInput.nama} onChange={(e) => setDosenInput({ ...dosenInput, nama: e.target.value })} placeholder="Nama dosen" />
          </div>
          <div className="flex-1">
            <label className="macos-label">NIDN</label>
            <input className="macos-input" value={dosenInput.nidn} onChange={(e) => setDosenInput({ ...dosenInput, nidn: e.target.value })} placeholder="NIDN" />
          </div>
          <button onClick={addDosen} className="macos-button mb-0.5">+ Tambah</button>
        </div>
        {formData.dosen_pengampu.map((d, i) => (
          <div key={i} className="flex items-center gap-2 p-2 bg-gray-50/50 rounded-apple-lg mb-1 text-sm">
            <span className="font-medium text-gray-700">{d.nama}</span>
            <span className="text-gray-400">({d.nidn})</span>
            <button onClick={() => setFormData(f => ({ ...f, dosen_pengampu: f.dosen_pengampu.filter((_, idx) => idx !== i) }))} className="ml-auto text-red-400 hover:text-red-600 text-xs">Hapus</button>
          </div>
        ))}
      </div>

      {/* Additional Context */}
      <div className="macos-card p-5">
        <label className="macos-label">Konteks Tambahan (opsional)</label>
        <textarea className="macos-input min-h-[80px] resize-none" value={formData.additional_context} onChange={(e) => setFormData({ ...formData, additional_context: e.target.value })} placeholder="Informasi tambahan untuk AI..." />
      </div>

      <button onClick={handleGenerate} disabled={generating} className="macos-button w-full py-3 flex items-center justify-center gap-2 text-base">
        {generating ? (
          <><Loader2 className="w-5 h-5 animate-spin" /> Mengenerate RPS...</>
        ) : (
          <><Sparkles className="w-5 h-5" /> Generate RPS dengan AI</>
        )}
      </button>

      {/* Preview */}
      {showPreview && rpsData && (
        <div className="space-y-4 animate-slide-up">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Preview RPS</h2>
            <button onClick={handleSave} className="macos-button flex items-center gap-2">
              <FileText className="w-4 h-4" /> Simpan RPS
            </button>
          </div>

          {/* CPMK */}
          <div className="macos-card overflow-hidden">
            <button onClick={() => setExpandedSection(expandedSection === 'cpmk' ? null : 'cpmk')} className="w-full p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
              <span className="text-sm font-semibold text-gray-900">CPMK ({rpsData.cpmk.length})</span>
              {expandedSection === 'cpmk' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {expandedSection === 'cpmk' && (
              <div className="px-4 pb-4 space-y-2">
                {rpsData.cpmk.map((c, i) => (
                  <div key={i} className="p-3 bg-gray-50/50 rounded-apple-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono font-bold text-macos-blue">{c.kode}</span>
                      <span className="text-xs text-gray-400">{c.taksonomi_bloom}</span>
                      <span className="text-xs text-gray-400">Bobot: {c.bobot}</span>
                    </div>
                    <p className="text-sm text-gray-700">{c.deskripsi}</p>
                    <p className="text-xs text-gray-400 mt-1">CPL: {c.cpl_prodi?.join(', ')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sub-CPMK */}
          <div className="macos-card overflow-hidden">
            <button onClick={() => setExpandedSection(expandedSection === 'subcpmk' ? null : 'subcpmk')} className="w-full p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
              <span className="text-sm font-semibold text-gray-900">Sub-CPMK ({rpsData.sub_cpmk.length})</span>
              {expandedSection === 'subcpmk' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {expandedSection === 'subcpmk' && (
              <div className="px-4 pb-4 space-y-2">
                {rpsData.sub_cpmk.map((s, i) => (
                  <div key={i} className="p-3 bg-gray-50/50 rounded-apple-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono font-bold text-orange-500">{s.kode}</span>
                      <span className="text-xs text-gray-400">→ {s.cpmk_kode}</span>
                    </div>
                    <p className="text-sm text-gray-700">{s.deskripsi}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {s.indikator?.map((ind, j) => (
                        <span key={j} className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">{ind}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rencana Pembelajaran */}
          <div className="macos-card overflow-hidden">
            <button onClick={() => setExpandedSection(expandedSection === 'rencana' ? null : 'rencana')} className="w-full p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
              <span className="text-sm font-semibold text-gray-900">Rencana Pembelajaran (16 Minggu)</span>
              {expandedSection === 'rencana' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {expandedSection === 'rencana' && (
              <div className="px-4 pb-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 pr-3 text-gray-500 font-medium">#</th>
                      <th className="text-left py-2 pr-3 text-gray-500 font-medium">Sub-CPMK</th>
                      <th className="text-left py-2 pr-3 text-gray-500 font-medium">Materi</th>
                      <th className="text-left py-2 pr-3 text-gray-500 font-medium">Metode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rpsData.rencana_pembelajaran.map((r) => (
                      <tr key={r.minggu_ke} className="border-b border-gray-100">
                        <td className="py-2 pr-3 font-mono text-xs text-gray-400">{r.minggu_ke}</td>
                        <td className="py-2 pr-3 text-xs text-gray-500">{r.sub_cpmk_kode}</td>
                        <td className="py-2 pr-3 text-gray-700">{r.materi}</td>
                        <td className="py-2 pr-3 text-xs text-gray-500">{r.metode?.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Penilaian */}
          <div className="macos-card overflow-hidden">
            <button onClick={() => setExpandedSection(expandedSection === 'penilaian' ? null : 'penilaian')} className="w-full p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
              <span className="text-sm font-semibold text-gray-900">Penilaian</span>
              {expandedSection === 'penilaian' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {expandedSection === 'penilaian' && (
              <div className="px-4 pb-4 grid grid-cols-2 gap-3">
                {rpsData.penilaian.map((p, i) => (
                  <div key={i} className="p-3 bg-gray-50/50 rounded-apple-lg">
                    <p className="text-sm font-medium text-gray-900">{p.komponen}</p>
                    <p className="text-xs text-gray-500 mt-1">Bobot: {(p.bobot * 100).toFixed(0)}% · {p.jenis}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {p.sub_cpmk_kode?.map((sc, j) => (
                        <span key={j} className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{sc}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button onClick={handleSave} className="macos-button w-full py-3 flex items-center justify-center gap-2 text-base">
            <FileText className="w-5 h-5" /> Simpan RPS
          </button>
        </div>
      )}
    </div>
  )
}