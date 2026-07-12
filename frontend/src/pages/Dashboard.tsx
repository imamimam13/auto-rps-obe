import { useEffect, useState } from 'react'
import {
  GraduationCap,
  BookOpen,
  FileText,
  CheckSquare,
  Sparkles,
  ArrowRight,
  BarChart3,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '@/services/api'

interface DashboardStats {
  prodi: number
  mata_kuliah: number
  rps: number
  obe_validated: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    prodi: 0,
    mata_kuliah: 0,
    rps: 0,
    obe_validated: 0,
  })
  const [ollamaStatus, setOllamaStatus] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [prodiRes, mkRes, rpsRes, ollamaRes] = await Promise.all([
          api.get('/api/v1/prodi/?size=1'),
          api.get('/api/v1/mata-kuliah/?size=1'),
          api.get('/api/v1/rps/?size=1'),
          api.get('/api/v1/ollama/status'),
        ])
        setStats({
          prodi: prodiRes.data.total || 0,
          mata_kuliah: mkRes.data.total || 0,
          rps: rpsRes.data.total || 0,
          obe_validated: 0,
        })
        setOllamaStatus(ollamaRes.data.available)
      } catch (e) {
        console.error('Failed to load dashboard', e)
      }
    }
    load()
  }, [])

  const statCards = [
    { label: 'Program Studi', value: stats.prodi, icon: GraduationCap, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Mata Kuliah', value: stats.mata_kuliah, icon: BookOpen, color: 'text-orange-500', bg: 'bg-orange-50' },
    { label: 'RPS Tersusun', value: stats.rps, icon: FileText, color: 'text-green-500', bg: 'bg-green-50' },
    { label: 'Validasi OBE', value: stats.obe_validated, icon: CheckSquare, color: 'text-purple-500', bg: 'bg-purple-50' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Selamat datang di Auto RPS & OBE AI</p>
        </div>
        {ollamaStatus ? (
          <span className="macos-tag flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Ollama Online
          </span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-500">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5" />
            Ollama Offline
          </span>
        )}
      </div>

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