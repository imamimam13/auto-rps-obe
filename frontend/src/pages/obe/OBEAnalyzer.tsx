import { useEffect, useState } from 'react'
import { CheckSquare, Search, AlertCircle, CheckCircle, BarChart3, TrendingUp } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'

export default function OBEAnalyzer() {
  const [rpsList, setRpsList] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedRps, setSelectedRps] = useState<any>(null)
  const [validating, setValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<any>(null)

  useEffect(() => {
    loadRPS()
  }, [])

  async function loadRPS() {
    try {
      const res = await api.get('/api/v1/rps/?size=50')
      setRpsList(res.data.items || [])
    } catch (e) {
      toast.error('Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }

  async function handleValidate(rpsId: number) {
    setValidating(true)
    setValidationResult(null)
    try {
      const res = await api.post('/api/v1/generate/validate-obe', { rps_id: rpsId })
      setValidationResult(res.data)
      const rps = rpsList.find(r => r.id === rpsId)
      if (rps) setSelectedRps(rps)
      toast.success(`Validasi selesai! Skor: ${res.data.score}`)
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Gagal validasi')
    } finally {
      setValidating(false)
    }
  }

  const filtered = rpsList.filter(r => r.kode?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Validasi OBE</h1>
          <p className="text-sm text-gray-500 mt-1">Periksa kesesuaian RPS dengan prinsip Outcome-Based Education</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Cari RPS..." value={search} onChange={(e) => setSearch(e.target.value)} className="macos-input pl-10" />
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* RPS List */}
        <div className="col-span-3 space-y-2">
          {loading ? (
            <p className="text-gray-400 text-sm">Memuat...</p>
          ) : filtered.length === 0 ? (
            <p className="text-gray-400 text-sm">Belum ada RPS</p>
          ) : (
            filtered.map((rps) => (
              <div key={rps.id} className={`macos-card p-4 cursor-pointer transition-all ${selectedRps?.id === rps.id ? 'ring-2 ring-macos-blue/30' : ''}`} onClick={() => { setSelectedRps(rps); setValidationResult(null) }}>
                <div className="flex items-center gap-3">
                  <CheckSquare className={`w-5 h-5 ${rps.obe_validated ? 'text-green-500' : 'text-gray-300'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{rps.kode}</p>
                    <p className="text-xs text-gray-500">Semester {rps.semester} · {rps.tahun_akademik}</p>
                  </div>
                  {rps.obe_validated && (
                    <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                      Skor: {rps.obe_score}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Validation Panel */}
        <div className="col-span-2">
          {selectedRps && (
            <div className="space-y-4">
              <div className="macos-card p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">{selectedRps.kode}</h3>
                <button onClick={() => handleValidate(selectedRps.id)} disabled={validating} className="macos-button w-full flex items-center justify-center gap-2">
                  {validating ? (
                    <><span className="animate-spin">◌</span> Memvalidasi...</>
                  ) : (
                    <><BarChart3 className="w-4 h-4" /> Validasi OBE</>
                  )}
                </button>
              </div>

              {validationResult && (
                <div className="space-y-4 animate-slide-up">
                  {/* Score */}
                  <div className="macos-card p-5 text-center">
                    <p className="text-xs text-gray-500 mb-1">Skor OBE</p>
                    <p className={`text-4xl font-bold ${validationResult.score >= 75 ? 'text-green-500' : validationResult.score >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                      {validationResult.score}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">dari 100</p>
                  </div>

                  {/* Detail Scores */}
                  {validationResult.details && (
                    <div className="macos-card p-5">
                      <h4 className="text-xs font-semibold text-gray-900 mb-3">Detail Penilaian</h4>
                      <div className="space-y-2">
                        {Object.entries(validationResult.details).map(([key, val]: [string, any]) => (
                          <div key={key} className="flex items-center justify-between">
                            <span className="text-xs text-gray-600 capitalize">{key.replace(/_/g, ' ')}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-macos-blue rounded-full" style={{ width: `${val}%` }} />
                              </div>
                              <span className="text-xs font-mono text-gray-500">{val}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Issues */}
                  {validationResult.issues?.length > 0 && (
                    <div className="macos-card p-5">
                      <h4 className="text-xs font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-red-500" /> Issues ({validationResult.issues.length})
                      </h4>
                      <div className="space-y-2">
                        {validationResult.issues.map((issue: any, i: number) => (
                          <div key={i} className={`p-3 rounded-apple-lg text-sm ${
                            issue.severity === 'high' ? 'bg-red-50' : issue.severity === 'medium' ? 'bg-yellow-50' : 'bg-gray-50'
                          }`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                issue.severity === 'high' ? 'bg-red-200 text-red-700' : 
                                issue.severity === 'medium' ? 'bg-yellow-200 text-yellow-700' : 'bg-gray-200 text-gray-700'
                              }`}>{issue.severity}</span>
                              <span className="text-xs text-gray-400">{issue.bagian}</span>
                            </div>
                            <p className="text-gray-700">{issue.deskripsi}</p>
                            {issue.saran && <p className="text-xs text-macos-blue mt-1">Saran: {issue.saran}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggestions */}
                  {validationResult.suggestions?.length > 0 && (
                    <div className="macos-card p-5">
                      <h4 className="text-xs font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-macos-blue" /> Saran Perbaikan
                      </h4>
                      <div className="space-y-2">
                        {validationResult.suggestions.map((s: any, i: number) => (
                          <div key={i} className="p-3 bg-blue-50 rounded-apple-lg text-sm">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">{s.prioritas}</span>
                              <span className="text-xs text-gray-400">{s.bagian}</span>
                            </div>
                            <p className="text-gray-700">{s.rekomendasi}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}