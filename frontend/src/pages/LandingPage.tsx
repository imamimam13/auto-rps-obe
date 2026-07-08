import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Search, GraduationCap, FileText, Download, Eye, ArrowRight } from 'lucide-react'
import api from '@/services/api'

interface Prodi {
  id: number
  kode: string
  nama: string
  visi: string
  misi: string
}

interface RPSItem {
  id: number
  kode: string
  mata_kuliah_id: number
  prodi_id: number
  semester: number
  tahun_akademik: string
  status: string
  identitas?: {
    nama_mata_kuliah: string
    kode_mata_kuliah: string
    sks: number
    semester: number
    ka_prodi?: string
  }
}

export default function LandingPage() {
  const [prodis, setProdis] = useState<Prodi[]>([])
  const [rpsList, setRpsList] = useState<RPSItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [prodiSearchQuery, setProdiSearchQuery] = useState('')
  const [selectedProdiId, setSelectedProdiId] = useState<number | null>(null)
  const [campusName, setCampusName] = useState('SEKOLAH TINGGI ILMU EKONOMI WIRA BHAKTI')
  const [campusLogo, setCampusLogo] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    fetchInitialData()
  }, [])

  async function fetchInitialData() {
    try {
      setLoading(true)
      try {
        const brandRes = await api.get('/api/v1/ollama/branding')
        if (brandRes.data.brand_campus_name) {
          setCampusName(brandRes.data.brand_campus_name)
        }
        if (brandRes.data.brand_campus_logo_url) {
          setCampusLogo(brandRes.data.brand_campus_logo_url)
        }
      } catch {
        // use fallback
      }

      const [prodiRes, rpsRes] = await Promise.all([
        api.get('/api/v1/prodi/'),
        api.get('/api/v1/rps/?limit=1000')
      ])

      const items = prodiRes.data?.items || []
      setProdis(items)
      if (items.length > 0) {
        setSelectedProdiId(items[0].id)
      }
      setRpsList(rpsRes.data?.items || [])
    } catch (e) {
      console.error('Failed to load public directory data', e)
    } finally {
      setLoading(false)
    }
  }

  // Filter prodi list inside sidebar
  const filteredProdis = prodis.filter(p => 
    p.nama.toLowerCase().includes(prodiSearchQuery.toLowerCase()) || 
    p.kode.toLowerCase().includes(prodiSearchQuery.toLowerCase())
  )

  // Filter & Search RPS (Only show published ones on the public landing page)
  const filteredRPS = rpsList.filter(rps => {
    if (rps.status !== 'published') return false
    if (selectedProdiId !== null && rps.prodi_id !== selectedProdiId) return false
    
    if (!searchQuery) return true
    const searchLower = searchQuery.toLowerCase()
    const name = rps.identitas?.nama_mata_kuliah || ''
    const code = rps.identitas?.kode_mata_kuliah || ''
    return name.toLowerCase().includes(searchLower) || code.toLowerCase().includes(searchLower)
  })

  // Download handlers
  function handleDownload(rpsId: number, format: 'pdf' | 'docx') {
    const url = `${api.defaults.baseURL}/api/v1/export/${rpsId}?export_format=${format}`
    window.open(url, '_blank')
  }

  return (
    <div className="min-h-screen w-screen bg-macos-bg flex items-center justify-center p-4 md:p-6 overflow-hidden relative">
      {/* Dynamic macOS Blur Orbs */}
      <div className="absolute top-[-25%] left-[-15%] w-[60%] h-[60%] rounded-full bg-blue-400/20 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-15%] w-[55%] h-[55%] rounded-full bg-purple-400/20 blur-[130px] pointer-events-none" />

      {/* Main Container Window */}
      <div className="macos-window w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-scale-in">
        {/* macOS Style Titlebar */}
        <div className="flex items-center justify-between px-4 py-3 bg-white/70 border-b border-gray-200/50 backdrop-blur-md shrink-0">
          {/* Traffic Lights */}
          <div className="macos-traffic shrink-0 flex items-center gap-1.5">
            <span className="macos-dot close w-3 h-3 rounded-full bg-[#ff5f57]" />
            <span className="macos-dot minimize w-3 h-3 rounded-full bg-[#febc2e]" />
            <span className="macos-dot maximize w-3 h-3 rounded-full bg-[#28c840]" />
          </div>
          
          {/* Title */}
          <div className="flex-1 text-center font-bold text-xs text-gray-500 tracking-wide flex items-center justify-center gap-2">
            {campusLogo ? (
              <img src={campusLogo} alt="Logo" className="w-4 h-4 object-contain" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-macos-blue" />
            )}
            <span className="line-clamp-1">{campusName} — DIREKTORI RPS OBE</span>
          </div>

          {/* Login Button */}
          <button
            onClick={() => navigate('/login')}
            className="text-xs font-semibold bg-gray-950 hover:bg-gray-800 text-white px-3 py-1.5 rounded-apple shadow-sm hover:shadow-apple transition-all duration-150 flex items-center gap-1"
          >
            Portal Dosen <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Window Content Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar - list of prodi */}
          <aside className="w-72 border-r border-gray-200/50 bg-[rgba(240,240,243,0.7)] backdrop-blur-md flex flex-col shrink-0">
            {/* Sidebar Header Search */}
            <div className="p-4 border-b border-gray-200/40">
              <h2 className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-3">PROGRAM STUDI</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  className="w-full pl-9 pr-3 py-1.5 bg-white/60 border border-gray-200/80 rounded-apple text-xs focus:outline-none focus:ring-1 focus:ring-macos-blue/30 focus:border-macos-blue transition-all"
                  placeholder="Cari Program Studi..."
                  value={prodiSearchQuery}
                  onChange={(e) => setProdiSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Sidebar Scrollable List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loading ? (
                <div className="text-center py-8 text-xs text-gray-400">Memuat prodi...</div>
              ) : filteredProdis.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-400 italic">Prodi tidak ditemukan</div>
              ) : (
                filteredProdis.map(prodi => {
                  const isActive = selectedProdiId === prodi.id
                  return (
                    <button
                      key={prodi.id}
                      onClick={() => setSelectedProdiId(prodi.id)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-apple transition-all flex items-center gap-2.5 ${
                        isActive
                          ? 'bg-white text-gray-900 shadow-sm font-semibold border-l-4 border-macos-blue'
                          : 'text-gray-600 hover:bg-black/5 hover:text-gray-900'
                      }`}
                    >
                      <GraduationCap className={`w-4 h-4 shrink-0 ${isActive ? 'text-macos-blue' : 'text-gray-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs truncate leading-snug">{prodi.nama}</p>
                        <p className="text-[9px] text-gray-400 font-mono mt-0.5">{prodi.kode}</p>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </aside>

          {/* Right Main Content Area - list of RPS */}
          <main className="flex-1 bg-white/40 backdrop-blur-md p-6 flex flex-col overflow-hidden">
            {/* Toolbar Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200/50 pb-4 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  {prodis.find(p => p.id === selectedProdiId)?.nama || 'Pilih Program Studi'}
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Daftar Rencana Pembelajaran Semester (RPS) Kurikulum OBE
                </p>
              </div>

              {/* RPS Search */}
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-200/80 rounded-apple text-xs placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-macos-blue/30 focus:border-macos-blue"
                  placeholder="Cari mata kuliah..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Scrollable RPS Grid */}
            <div className="flex-1 overflow-y-auto mt-4 pr-1">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-2">
                  <div className="w-6 h-6 border-2 border-macos-blue border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs text-gray-400">Memuat berkas...</p>
                </div>
              ) : filteredRPS.length === 0 ? (
                <div className="macos-card p-12 text-center bg-white/40 border-white/20">
                  <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-500 font-medium">Tidak ada dokumen RPS terbit untuk program studi ini.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {filteredRPS.map(rps => (
                    <div
                      key={rps.id}
                      className="macos-card p-4 bg-white/80 border-white/50 hover:bg-white hover:shadow-apple-lg hover:scale-[1.01] transition-all duration-200 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[9px] font-bold text-macos-blue bg-blue-50/80 border border-blue-100/30 px-2 py-0.5 rounded-apple">
                            SKS: {rps.identitas?.sks || 3} · Semester: {rps.semester}
                          </span>
                          <span className="text-[10px] font-mono text-gray-400">
                            {rps.tahun_akademik}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-gray-800 mt-2.5 leading-snug">
                          {rps.identitas?.nama_mata_kuliah || 'RPS Mata Kuliah'}
                        </h4>
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                          Kode: {rps.identitas?.kode_mata_kuliah || '-'}
                        </p>
                      </div>

                      <div className="mt-5 pt-3 border-t border-gray-100/80 flex items-center justify-between gap-2">
                        {/* Preview */}
                        <button
                          onClick={() => navigate(`/rps-preview/${rps.id}`)}
                          className="text-[11px] font-bold text-gray-700 hover:text-gray-900 hover:bg-gray-100 px-3 py-1.5 rounded-apple border border-gray-200/80 bg-white shadow-sm transition-all flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5 text-gray-500" />
                          Pratinjau
                        </button>

                        {/* Download formats */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleDownload(rps.id, 'pdf')}
                            className="text-[10px] font-bold bg-red-50 text-red-700 hover:bg-red-100 px-2.5 py-1.5 rounded-apple transition-all flex items-center gap-1"
                            title="Download PDF"
                          >
                            <Download className="w-3 h-3" />
                            PDF
                          </button>
                          <button
                            onClick={() => handleDownload(rps.id, 'docx')}
                            className="text-[10px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 px-2.5 py-1.5 rounded-apple transition-all flex items-center gap-1"
                            title="Download Word"
                          >
                            <Download className="w-3 h-3" />
                            DOCX
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
