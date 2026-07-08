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

      setProdis(prodiRes.data || [])
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
    const url = `${api.defaults.baseURL}/api/v1/export/${format}?rps_id=${rpsId}`
    window.open(url, '_blank')
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-900 font-sans">
      {/* Premium Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {campusLogo ? (
            <img src={campusLogo} alt="Logo" className="w-9 h-9 object-contain" />
          ) : (
            <div className="w-9 h-9 rounded-apple-lg bg-gradient-to-br from-macos-blue to-purple-500 flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
          )}
          <div>
            <h1 className="text-xs font-bold tracking-wider text-gray-400 uppercase">Sistem Informasi RPS OBE</h1>
            <p className="text-sm font-semibold text-gray-800 line-clamp-1">{campusName}</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/login')}
          className="text-xs font-semibold bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-apple-lg shadow-sm transition-all flex items-center gap-1.5"
        >
          Portal Dosen <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </header>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 py-12 text-center">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 leading-tight">
          Direktori Rencana Pembelajaran Semester (RPS)
        </h2>
        <p className="text-base text-gray-500 max-w-2xl mx-auto mt-3">
          Temukan dan unduh RPS kurikulum Outcome-Based Education (OBE) resmi yang telah dirumuskan berdasarkan Capaian Pembelajaran Lulusan (CPL) program studi.
        </p>

        {/* Global Floating Search bar */}
        <div className="max-w-lg mx-auto mt-8 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            className="w-full pl-11 pr-5 py-3.5 bg-white border border-gray-200 rounded-apple-xl shadow-sm text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-macos-blue/20 focus:border-macos-blue transition-all"
            placeholder="Cari mata kuliah atau kode (misal: SIM, Manajemen)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-6 pb-20">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="w-8 h-8 border-3 border-macos-blue border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-gray-400">Memuat direktori dokumen...</p>
          </div>
        ) : prodis.length === 0 ? (
          <div className="bg-white rounded-apple-xl border border-gray-100 p-12 text-center">
            <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">Belum ada program studi terdaftar.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {prodis.map(prodi => {
              // Get RPS belonging to this prodi
              const prodiRPS = filteredRPS.filter(r => r.prodi_id === prodi.id)
              if (searchQuery && prodiRPS.length === 0) return null // Hide prodi if it doesn't match search query

              return (
                <div key={prodi.id} className="space-y-4">
                  {/* Prodi Heading */}
                  <div className="flex items-center gap-3 border-b border-gray-200 pb-3">
                    <div className="p-2 bg-macos-blue/10 rounded-apple-lg">
                      <GraduationCap className="w-5 h-5 text-macos-blue" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{prodi.nama}</h3>
                      <p className="text-xs text-gray-400 font-mono">Kode Program Studi: {prodi.kode}</p>
                    </div>
                    <span className="ml-auto text-xs font-medium text-gray-500 bg-white border border-gray-200 px-2.5 py-1 rounded-apple-md shadow-sm">
                      {prodiRPS.length} Dokumen
                    </span>
                  </div>

                  {/* RPS Lists */}
                  {prodiRPS.length === 0 ? (
                    <div className="bg-white/60 rounded-apple-xl border border-gray-100 p-6 text-center text-xs text-gray-400">
                      Tidak ada RPS kurikulum terbit untuk program studi ini.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {prodiRPS.map(rps => (
                        <div
                          key={rps.id}
                          className="bg-white p-5 rounded-apple-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-start justify-between">
                              <span className="text-[10px] font-semibold text-macos-blue bg-blue-50 px-2 py-0.5 rounded">
                                SKS: {rps.identitas?.sks || 3} · Semester: {rps.semester}
                              </span>
                              <span className="text-[10px] font-mono text-gray-400">
                                {rps.tahun_akademik}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-gray-800 mt-2 leading-snug">
                              {rps.identitas?.nama_mata_kuliah || 'RPS Mata Kuliah'}
                            </h4>
                            <p className="text-xs text-gray-400 font-mono mt-0.5">
                              Kode MK: {rps.identitas?.kode_mata_kuliah || '-'}
                            </p>
                          </div>

                          <div className="mt-5 pt-3 border-t border-gray-50 flex items-center justify-between gap-2">
                            {/* Preview Link */}
                            <button
                              onClick={() => navigate(`/rps-preview/${rps.id}`)}
                              className="text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-3 py-1.5 rounded-apple-lg border border-gray-200 shadow-sm transition-all flex items-center gap-1.5"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Pratinjau
                            </button>

                            {/* Download Action dropdown style buttons */}
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleDownload(rps.id, 'pdf')}
                                className="text-[11px] font-semibold bg-red-50 text-red-700 hover:bg-red-100 px-2.5 py-1.5 rounded-apple-md transition-all flex items-center gap-1"
                                title="Download PDF"
                              >
                                <Download className="w-3 h-3" />
                                PDF
                              </button>
                              <button
                                onClick={() => handleDownload(rps.id, 'docx')}
                                className="text-[11px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 px-2.5 py-1.5 rounded-apple-md transition-all flex items-center gap-1"
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
      <footer className="bg-white border-t border-gray-100 py-6 text-center text-xs text-gray-400">
        <p>© {new Date().getFullYear()} {campusName}. Hak Cipta Dilindungi.</p>
        <p className="mt-1">Penyusunan kurikulum berbasis OBE otomatis didukung teknologi Kecerdasan Buatan (AI).</p>
      </footer>
    </div>
  )
}
