import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Search, Filter, CheckCircle, Clock, AlertCircle, Download } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'

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
  const [rpsList, setRpsList] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [statusFilter])

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

  const filtered = rpsList.filter((r) =>
    r.kode?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">RPS</h1>
          <p className="text-sm text-gray-500 mt-1">Rencana Pembelajaran Semester</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Cari RPS..." value={search} onChange={(e) => setSearch(e.target.value)} className="macos-input pl-10" />
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
            return (
              <div key={rps.id} className="macos-card p-4 flex items-center gap-4 group">
                <div className="p-3 rounded-apple-lg bg-green-50">
                  <FileText className="w-5 h-5 text-green-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <Link to={`/rps/${rps.id}`} className="text-sm font-semibold text-gray-900 hover:text-macos-blue transition-colors">
                    {rps.kode}
                  </Link>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Semester {rps.semester} · {rps.tahun_akademik}
                    {rps.obe_validated && ` · OBE: ${rps.obe_score}`}
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[rps.status] || 'bg-gray-50 text-gray-600'}`}>
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
    </div>
  )
}