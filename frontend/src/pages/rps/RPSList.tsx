import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Search, Filter, CheckCircle, Clock, AlertCircle, Download, Sparkles } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'

const statusColors: Record<string, string> = {
  draft: 'bg-gray-50 text-gray-600',
  review: 'bg-yellow-50 text-yellow-600',
  approved: 'bg-green-50 text-green-600',
  published: 'bg-blue-50 text-blue-600',
}

const statusIcons: Record<string, any> = {
  draft: Clock,
  review: AlertCircle,
  approved: CheckCircle,
  published: CheckCircle,
}

export default function RPSList() {
  const { isAdmin } = useAuth()
  const [rpsList, setRpsList] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [prodis, setProdis] = useState<any[]>([])
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkGenerating, setBulkGenerating] = useState(false)
  const [bulkConfig, setBulkConfig] = useState({
    prodi_id: '',
    tahun_akademik: '2025/2026',
    semester: '',
    additional_context: '',
  })

  useEffect(() => {
    loadData()
  }, [statusFilter])

  async function openBulkModal() {
    try {
      const res = await api.get('/api/v1/prodi/?size=50')
      setProdis(res.data.items || [])
      setShowBulkModal(true)
    } catch {
      toast.error('Gagal memuat daftar Program Studi')
    }
  }

  async function handleBulkGenerate() {
    if (!bulkConfig.prodi_id) {
      toast.error('Silakan pilih Program Studi terlebih dahulu')
      return
    }
    setBulkGenerating(true)
    try {
      const res = await api.post('/api/v1/generate/bulk-rps', {
        prodi_id: Number(bulkConfig.prodi_id),
        semester: bulkConfig.semester ? Number(bulkConfig.semester) : null,
        tahun_akademik: bulkConfig.tahun_akademik,
        additional_context: bulkConfig.additional_context || '',
      })
      const { created, total, errors, error_detail } = res.data
      toast.success(`Berhasil generate ${created} dari ${total} RPS!`)
      if (errors > 0) {
        console.error('Bulk generate errors:', error_detail)
        toast.error(`${errors} mata kuliah gagal di-generate`)
      }
      setShowBulkModal(false)
      loadData()
    } catch (e: any) {
      toast.error(e.response?.data?.detail || e.message || 'Gagal bulk generate RPS')
    } finally {
      setBulkGenerating(false)
    }
  }

  async function loadData() {
    try {
      const params = statusFilter ? `?status=${statusFilter}&size=50` : '?size=50'
      const res = await api.get(`/api/v1/rps/${params}`)
      setRpsList(res.data.items || [])
    } catch (e) {
      toast.error('Gagal memuat RPS')
    } finally {
      setLoading(false)
    }
  }

  async function handleExport(id: number, format: string) {
    try {
      const res = await api.post(`/api/v1/export/${id}?export_format=${format}`, {}, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `RPS-${id}.${format}`
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success(`Berhasil export ${format.toUpperCase()}`)
    } catch (e) {
      toast.error('Gagal export')
    }
  }

  const filtered = rpsList.filter((r) => {
    const searchLower = search.toLowerCase()
    const matchKode = r.kode?.toLowerCase().includes(searchLower)
    const matchMK = r.identitas?.nama_mata_kuliah?.toLowerCase().includes(searchLower)
    const matchDosen = r.dosen_pengampu?.some((d: any) => d.nama?.toLowerCase().includes(searchLower))
    return matchKode || matchMK || matchDosen
  })

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">RPS</h1>
          <p className="text-sm text-gray-500 mt-1">Rencana Pembelajaran Semester</p>
        </div>
        {isAdmin && (
          <button
            onClick={openBulkModal}
            className="macos-button flex items-center gap-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-medium text-xs px-3.5 py-2.5 rounded-apple-lg shadow-sm"
          >
            <Sparkles className="w-4 h-4" /> Bulk Generate RPS
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Cari berdasarkan mata kuliah, dosen, atau kode..." value={search} onChange={(e) => setSearch(e.target.value)} className="macos-input pl-10" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="macos-input max-w-[150px]">
          <option value="">Semua Status</option>
          <option value="draft">Draft</option>
          <option value="review">Review</option>
          <option value="approved">Approved</option>
          <option value="published">Published</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Memuat...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Belum ada RPS</div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((rps) => {
            const StatusIcon = statusIcons[rps.status] || Clock
            const dosenNames = rps.dosen_pengampu?.map((d: any) => d.nama).join(', ') || '-'
            return (
              <div key={rps.id} className="macos-card p-4 flex items-center gap-4 group">
                <div className="p-3 rounded-apple-lg bg-green-50">
                  <FileText className="w-5 h-5 text-green-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <Link to={`/rps/${rps.id}`} className="text-sm font-semibold text-gray-900 hover:text-macos-blue transition-colors block truncate">
                    {rps.identitas?.nama_mata_kuliah || 'RPS Tanpa Nama'}
                  </Link>
                  <p className="text-xs text-gray-600 mt-0.5 truncate">
                    Dosen: <span className="font-medium text-gray-700">{dosenNames}</span>
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Kode: {rps.kode} · Semester {rps.semester} · {rps.tahun_akademik}
                    {rps.obe_validated && ` · OBE: ${rps.obe_score}/100`}
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${statusColors[rps.status] || 'bg-gray-50 text-gray-600'}`}>
                  <StatusIcon className="w-3 h-3" />
                  {rps.status}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleExport(rps.id, 'pdf')} className="macos-button-ghost px-2.5 py-1.5 text-xs" title="Export PDF">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleExport(rps.id, 'docx')} className="macos-button-ghost px-2.5 py-1.5 text-xs" title="Export DOCX">
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Bulk Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="macos-card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto animate-scale-up space-y-5 bg-white/95 shadow-2xl rounded-apple-xl border border-white/20">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-50 rounded-apple-lg">
                <Sparkles className="w-5 h-5 text-purple-500 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Bulk Generate RPS</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Generate RPS untuk semua mata kuliah prodi sekaligus.</p>
              </div>
            </div>

            <div className="space-y-3.5 pt-2">
              <div>
                <label className="macos-label">Pilih Program Studi *</label>
                <select
                  className="macos-input"
                  value={bulkConfig.prodi_id}
                  onChange={(e) => setBulkConfig({ ...bulkConfig, prodi_id: e.target.value })}
                  required
                >
                  <option value="">-- Pilih Program Studi --</option>
                  {prodis.map((p) => (
                    <option key={p.id} value={p.id}>{p.nama} ({p.kode})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="macos-label">Tahun Akademik</label>
                <input
                  className="macos-input"
                  value={bulkConfig.tahun_akademik}
                  onChange={(e) => setBulkConfig({ ...bulkConfig, tahun_akademik: e.target.value })}
                  placeholder="2025/2026"
                />
              </div>

              <div>
                <label className="macos-label">Filter Semester (Opsional)</label>
                <input
                  type="number"
                  className="macos-input"
                  value={bulkConfig.semester}
                  onChange={(e) => setBulkConfig({ ...bulkConfig, semester: e.target.value })}
                  placeholder="Semua Semester"
                  min={1}
                  max={14}
                />
                <p className="text-[10px] text-gray-400 mt-1">Kosongkan untuk meng-generate semua semester sekaligus.</p>
              </div>

              <div>
                <label className="macos-label">Konteks Tambahan (Opsional)</label>
                <textarea
                  className="macos-input min-h-[80px] resize-none"
                  value={bulkConfig.additional_context}
                  onChange={(e) => setBulkConfig({ ...bulkConfig, additional_context: e.target.value })}
                  placeholder="Informasi tambahan untuk membimbing AI..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowBulkModal(false)}
                disabled={bulkGenerating}
                className="macos-button-ghost px-4 py-2 text-xs"
              >
                Batal
              </button>
              <button
                onClick={handleBulkGenerate}
                disabled={bulkGenerating}
                className="macos-button py-2.5 px-4 flex items-center gap-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-medium text-xs rounded-apple-lg disabled:from-gray-300 disabled:to-gray-400"
              >
                {bulkGenerating ? (
                  <>Mengenerate semua...</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Mulai Generate</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}