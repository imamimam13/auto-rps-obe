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
  const [campusName, setCampusName] = useState('SEKOLAH TINGGI ILMU EKONOMI WIRA BHAKTI')
  const [campusLogo, setCampusLogo] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    fetchInitialData()
  }, [])

  async function fetchInitialData() {
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
        // use fallback
      }

      // Load prodi and rps list
      const [prodiRes, rpsRes] = await Promise.all([
        api.get('/api/v1/prodi/'),
        api.get('/api/v1/rps/?limit=1000')
      ])

      setProdis(prodiRes.data?.items || [])
      setRpsList(rpsRes.data?.items || [])
    } catch (e) {
      console.error('Failed to load public directory data', e)
    } finally {
      setLoading(false)
    }
  }

  // Filter & Search RPS (Only show published ones on the public landing page)
  const filteredRPS = rpsList.filter(rps => {
    if (rps.status !== 'published') return false
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
    <div className="min-h-screen bg-gradient-to-tr from-[#f5f5f7] via-[#f0f4ff] to-[#f6f6f9] text-gray-900 font-sans pb-20 relative overflow-hidden">
      {/* Decorative Blur Orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-300/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-purple-300/20 blur-[120px] pointer-events-none" />

      {/* Premium Glass Header */}
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-gray-200/50 px-6 py-4 flex items-center justify-between shadow-[0_2px_20px_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-3">
          {campusLogo ? (
            <img src={campusLogo} alt="Logo" className="w-9 h-9 object-contain" />
          ) : (
            <div className="w-9 h-9 rounded-apple-lg bg-gradient-to-br from-macos-blue to-purple-500 flex items-center justify-center shadow-md">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
          )}
          <div>
            <h1 className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Sistem Informasi RPS OBE</h1>
            <p className="text-sm font-semibold text-gray-800 line-clamp-1">{campusName}</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/login')}
          className="text-xs font-semibold bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-apple shadow-sm hover:shadow-apple transition-all duration-150 flex items-center gap-1.5"
        >
          Portal Dosen <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </header>

      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-12 text-center relative z-10">
        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900 leading-tight">
          Direktori Rencana Pembelajaran Semester <br />
          <span className="bg-gradient-to-r from-macos-blue via-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Kurikulum Berbasis OBE
          </span>
        </h2>
        <p className="text-sm md:text-base text-gray-500 max-w-2xl mx-auto mt-4 leading-relaxed">
          Temukan dan unduh dokumen RPS Outcome-Based Education (OBE) resmi yang telah diselaraskan dengan Capaian Pembelajaran Lulusan (CPL) program studi.
        </p>

        {/* Global Floating Search bar */}
        <div className="max-w-xl mx-auto mt-8 relative shadow-lg rounded-apple-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            className="w-full pl-11 pr-5 py-3.5 bg-white/90 backdrop-blur-md border border-gray-200/80 rounded-apple-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-macos-blue/30 focus:border-macos-blue transition-all duration-200"
            placeholder="Cari mata kuliah atau kode (misal: SIM, Manajemen)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-6 relative z-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <div className="w-8 h-8 border-2 border-macos-blue border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-gray-400 font-medium">Memuat direktori dokumen...</p>
          </div>
        ) : prodis.length === 0 ? (
          <div className="macos-card p-12 text-center bg-white/50 border-white/30">
            <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">Belum ada program studi terdaftar.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {prodis.map(prodi => {
              // Get RPS belonging to this prodi
              const prodiRPS = filteredRPS.filter(r => r.prodi_id === prodi.id)
              if (searchQuery && prodiRPS.length === 0) return null // Hide prodi if it doesn't match search query

              return (
                <div key={prodi.id} className="space-y-5">
                  {/* Prodi Heading */}
                  <div className="flex items-center gap-3 border-b border-gray-200 pb-3">
                    <div className="p-2 bg-macos-blue/10 rounded-apple-lg">
                      <GraduationCap className="w-5 h-5 text-macos-blue" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">{prodi.nama}</h3>
                      <p className="text-[10px] text-gray-400 font-mono tracking-wide uppercase">Kode Prodi: {prodi.kode}</p>
                    </div>
                    <span className="ml-auto text-[11px] font-semibold text-gray-600 bg-white border border-gray-200 px-3 py-1 rounded-apple shadow-sm">
                      {prodiRPS.length} Dokumen
                    </span>
                  </div>

                  {/* RPS Lists */}
                  {prodiRPS.length === 0 ? (
                    <div className="macos-card p-8 text-center text-xs text-gray-400 italic bg-white/40 border-white/20">
                      Tidak ada RPS kurikulum terbit untuk program studi ini.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {prodiRPS.map(rps => (
                        <div
                          key={rps.id}
                          className="macos-card p-5 bg-white/70 border-white/50 hover:bg-white/90 hover:scale-[1.01] transition-all duration-200 flex flex-col justify-between shadow-apple"
                        >
                          <div>
                            <div className="flex items-start justify-between">
                              <span className="text-[10px] font-semibold text-macos-blue bg-blue-50/80 border border-blue-100/50 px-2 py-0.5 rounded-apple">
                                SKS: {rps.identitas?.sks || 3} · Semester: {rps.semester}
                              </span>
                              <span className="text-[10px] font-mono font-medium text-gray-400">
                                {rps.tahun_akademik}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-gray-800 mt-3 leading-snug">
                              {rps.identitas?.nama_mata_kuliah || 'RPS Mata Kuliah'}
                            </h4>
                            <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                              Kode MK: {rps.identitas?.kode_mata_kuliah || '-'}
                            </p>
                          </div>

                          <div className="mt-6 pt-3.5 border-t border-gray-100/80 flex items-center justify-between gap-2">
                            {/* Preview Link */}
                            <button
                              onClick={() => navigate(`/rps-preview/${rps.id}`)}
                              className="text-xs font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100/80 px-3.5 py-1.5 rounded-apple border border-gray-200/80 bg-white shadow-sm hover:shadow transition-all duration-150 flex items-center gap-1.5"
                            >
                              <Eye className="w-3.5 h-3.5 text-gray-500" />
                              Pratinjau
                            </button>

                            {/* Download Action dropdown style buttons */}
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleDownload(rps.id, 'pdf')}
                                className="text-[10px] font-bold bg-red-50 text-red-700 hover:bg-red-100/70 border border-red-100/30 px-3 py-1.5 rounded-apple transition-all duration-150 flex items-center gap-1 shadow-sm"
                                title="Download PDF"
                              >
                                <Download className="w-3 h-3" />
                                PDF
                              </button>
                              <button
                                onClick={() => handleDownload(rps.id, 'docx')}
                                className="text-[10px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100/70 border border-blue-100/30 px-3 py-1.5 rounded-apple transition-all duration-150 flex items-center gap-1 shadow-sm"
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
              )
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-20 py-8 text-center text-xs text-gray-400/80 border-t border-gray-200/40 bg-white/40 backdrop-blur-md">
        <p>© {new Date().getFullYear()} {campusName}. Hak Cipta Dilindungi.</p>
        <p className="mt-1">Penyusunan kurikulum berbasis OBE otomatis didukung teknologi Kecerdasan Buatan (AI).</p>
      </footer>
    </div>
  )
}
