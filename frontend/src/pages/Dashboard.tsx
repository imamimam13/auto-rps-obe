import { useEffect, useState } from 'react'
import {
  GraduationCap,
  BookOpen,
  FileText,
  CheckSquare,
  Sparkles,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  History,
  ChevronDown,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '@/services/api'
import toast from 'react-hot-toast'

interface DashboardStats {
  prodi: number
  mata_kuliah: number
  rps: number
  obe_validated: number
}

interface PeriodeItem {
  id: number
  kode: string
  nama: string
  tahun_akademik: string
  semester_tipe: string
  is_active: boolean
  status: string
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    prodi: 0,
    mata_kuliah: 0,
    rps: 0,
    obe_validated: 0,
  })
  const [aiStatus, setAiStatus] = useState(false)
  const [aiProvider, setAiProvider] = useState('AI')
  const [periodes, setPeriodes] = useState<PeriodeItem[]>([])
  const [activePeriode, setActivePeriode] = useState<PeriodeItem | null>(null)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [updatingActive, setUpdatingActive] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [prodiRes, mkRes, rpsRes, aiRes, perRes] = await Promise.all([
        api.get('/api/v1/prodi/?size=1'),
        api.get('/api/v1/mata-kuliah/?size=1'),
        api.get('/api/v1/rps/?size=1'),
        api.get('/api/v1/ollama/status'),
        api.get('/api/v1/periode/'),
      ])
      setStats({
        prodi: prodiRes.data.total || 0,
        mata_kuliah: mkRes.data.total || 0,
        rps: rpsRes.data.total || 0,
        obe_validated: 0,
      })
      setAiStatus(aiRes.data.available)
      const p = aiRes.data.provider || 'AI'
      const label = p === 'lmstudio' ? 'LM Studio' : p === 'openai' ? 'OpenAI' : p === '9router' ? '9Router' : p === 'ollama' ? 'Ollama' : 'AI Engine'
      setAiProvider(label)
      const pList = perRes.data.items || []
      setPeriodes(pList)
      const act = pList.find((p: PeriodeItem) => p.is_active)
      setActivePeriode(act || pList[0] || null)
    } catch (e) {
      console.error('Failed to load dashboard', e)
    }
  }

  async function handleSetActive(periodeId: number, nama: string) {
    try {
      setUpdatingActive(true)
      await api.put(`/api/v1/periode/${periodeId}/set-active`)
      toast.success(`Periode aktif berhasil diubah ke ${nama}`)
      await loadData()
      setShowHistoryModal(false)
    } catch (e) {
      toast.error('Gagal memperbarui periode aktif')
    } finally {
      setUpdatingActive(false)
    }
  }

  const statCards = [
    { label: 'Program Studi', value: stats.prodi, icon: GraduationCap, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Mata Kuliah', value: stats.mata_kuliah, icon: BookOpen, color: 'text-orange-500', bg: 'bg-orange-50' },
    { label: 'RPS Tersusun', value: stats.rps, icon: FileText, color: 'text-green-500', bg: 'bg-green-50' },
    { label: 'Validasi OBE', value: stats.obe_validated, icon: CheckSquare, color: 'text-purple-500', bg: 'bg-purple-50' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Selamat datang di Auto RPS & OBE AI</p>
        </div>
        <div className="flex items-center gap-2">
          {aiStatus ? (
            <span className="macos-tag flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              {aiProvider} Online
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-500">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5" />
              {aiProvider} Offline
            </span>
          )}
        </div>
      </div>

      {/* Active Periode & History Banner */}
      <div className="macos-card p-5 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white relative overflow-hidden shadow-apple-lg">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-apple bg-white/10 backdrop-blur-md">
                <Calendar className="w-4 h-4 text-blue-300" />
              </span>
              <span className="text-xs uppercase tracking-wider font-semibold text-blue-200">
                Periode Akademik Aktif
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-300 border border-green-400/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Aktif
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white mt-1">
              {activePeriode ? activePeriode.nama : 'Memuat Periode...'}
            </h2>
            <p className="text-xs text-blue-200/80">
              Tahun Akademik: {activePeriode?.tahun_akademik || '-'} · Tipe: {activePeriode?.semester_tipe?.toUpperCase() || '-'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistoryModal(true)}
              className="px-3.5 py-2 rounded-apple bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-semibold backdrop-blur-md transition-all flex items-center gap-2"
            >
              <History className="w-4 h-4 text-blue-300" />
              History & Ganti Periode
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            </button>
          </div>
        </div>
      </div>

      {/* Periode History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="macos-card p-6 w-full max-w-md bg-white shadow-2xl rounded-apple-xl border border-gray-100">
            <div className="flex items-center justify-between mb-4 border-b pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-macos-blue" />
                <h3 className="text-base font-semibold text-gray-900">History Periode Akademik</h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-4">
              Pilih periode di bawah ini untuk menetapkannya sebagai **Periode Aktif** saat ini.
            </p>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {periodes.map((p) => (
                <div
                  key={p.id}
                  className={`p-3 rounded-apple border transition-all flex items-center justify-between ${
                    p.is_active
                      ? 'border-macos-blue bg-blue-50/50 shadow-xs'
                      : 'border-gray-200/80 hover:bg-gray-50'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-gray-900">{p.nama}</p>
                      {p.is_active && (
                        <span className="text-[9px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                          AKTIF
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Kode: {p.kode} · Tahun: {p.tahun_akademik} · Status: {p.status}
                    </p>
                  </div>

                  {!p.is_active && (
                    <button
                      onClick={() => handleSetActive(p.id, p.nama)}
                      disabled={updatingActive}
                      className="macos-button-ghost text-xs px-2.5 py-1 text-macos-blue hover:bg-blue-100/50"
                    >
                      Set Aktif
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-5 pt-3 border-t flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="macos-button-ghost text-xs px-4 py-2"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="macos-card p-5">
            <div className="flex items-center justify-between">
              <div className={`p-2.5 rounded-apple-lg ${card.bg}`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
            </div>
            <p className="text-2xl font-semibold mt-3 text-gray-900">{card.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to="/rps/generate/new" className="macos-card p-5 group cursor-pointer hover:shadow-apple-lg transition-all">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-apple-lg bg-gradient-to-br from-macos-blue to-blue-600">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900">Generate RPS dengan AI</h3>
              <p className="text-xs text-gray-500 mt-0.5">Susun RPS otomatis dari visi misi prodi</p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-macos-blue transition-colors" />
          </div>
        </Link>

        <Link to="/obe" className="macos-card p-5 group cursor-pointer hover:shadow-apple-lg transition-all">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-apple-lg bg-gradient-to-br from-purple-500 to-purple-600">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900">Validasi OBE</h3>
              <p className="text-xs text-gray-500 mt-0.5">Periksa kelengkapan OBE pada RPS</p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-purple-500 transition-colors" />
          </div>
        </Link>
      </div>
    </div>
  )
}