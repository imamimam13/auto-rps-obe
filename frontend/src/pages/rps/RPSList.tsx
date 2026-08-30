import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Search, Filter, CheckCircle, Clock, AlertCircle, Download, Sparkles, Trash2 } from 'lucide-react'
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
  const [prodiFilter, setProdiFilter] = useState('')
  const [periodeFilter, setPeriodeFilter] = useState('')
  const [periodes, setPeriodes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [prodis, setProdis] = useState<any[]>([])
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkGenerating, setBulkGenerating] = useState(false)
  const [bulkStopped, setBulkStopped] = useState(false)
  const bulkStopRef = { current: false }
  const [bulkProgress, setBulkProgress] = useState<{
    currentPass: number
    maxPasses: number
    current: number
    total: number
    currentName: string
    statusMessage: string
    done: { kode: string; nama: string; rps_id: number; sdgs?: number[]; bloom_updated?: boolean }[]
    errors: { id: number; kode: string; nama: string; prodi_id: number; semester: number; error: string }[]
    skipped: { kode: string; nama: string }[]
  } | null>(null)

  const [bulkConfig, setBulkConfig] = useState({
    prodi_id: 'all',
    tahun_akademik: '2025/2026',
    semester: '',
    additional_context: '',
    skip_existing: true,
    auto_retry: true,
    max_retries: 3,
  })

  async function loadProdis() {
    try {
      const res = await api.get('/api/v1/prodi/?size=100')
      setProdis(res.data.items || [])
    } catch (e) {
      console.error('Gagal memuat prodi list', e)
    }
  }

  async function loadPeriodes() {
    try {
      const res = await api.get('/api/v1/periode/')
      const pList = res.data.items || []
      setPeriodes(pList)
      const act = pList.find((p: any) => p.is_active)
      if (act) {
        setBulkConfig(prev => ({ ...prev, tahun_akademik: act.tahun_akademik || act.nama }))
      }
    } catch (e) {
      console.error('Gagal memuat periode list', e)
    }
  }

  async function openBulkModal() {
    if (prodis.length === 0) {
      await loadProdis()
    }
    setShowBulkModal(true)
  }

  async function handleBulkGenerate() {
    setBulkGenerating(true)
    bulkStopRef.current = false
    setBulkStopped(false)
    setBulkProgress(null)

    try {
      // 1. Fetch target mata kuliah (Selected Prodi or ALL Prodis)
      let url = `/api/v1/mata-kuliah/?size=500`
      if (bulkConfig.prodi_id && bulkConfig.prodi_id !== 'all') {
        url += `&prodi_id=${bulkConfig.prodi_id}`
      }
      if (bulkConfig.semester) {
        url += `&semester=${bulkConfig.semester}`
      }
      const mkRes = await api.get(url)
      const allMkList: any[] = mkRes.data.items || []

      if (allMkList.length === 0) {
        toast.error('Tidak ada mata kuliah ditemukan untuk kriteria ini')
        setBulkGenerating(false)
        return
      }

      // 2. Check existing RPS records to skip if enabled
      let existingKeys = new Set<string>()
      let existingMkIds = new Set<number>()
      if (bulkConfig.skip_existing) {
        let rpsUrl = `/api/v1/rps/?size=1000&limit=1000`
        if (bulkConfig.prodi_id && bulkConfig.prodi_id !== 'all') {
          rpsUrl += `&prodi_id=${bulkConfig.prodi_id}`
        }
        const rpsRes = await api.get(rpsUrl)
        const existingRps: any[] = rpsRes.data.items || []
        for (const r of existingRps) {
          existingMkIds.add(r.mata_kuliah_id)
          const rTa = (r.tahun_akademik || r.identitas?.tahun_akademik || '').toLowerCase().trim()
          existingKeys.add(`${r.mata_kuliah_id}_${rTa}`)
        }
      }

      const targetPeriodLower = (bulkConfig.tahun_akademik || '').toLowerCase().trim()

      const done: any[] = []
      const skipped: any[] = []
      let failedQueue: any[] = []

      // Separate into skipped vs work items
      const toProcess: any[] = []
      for (const mk of allMkList) {
        let isAlreadyExists = false
        if (bulkConfig.skip_existing) {
          if (targetPeriodLower) {
            // Check if RPS exists for this MK and matching target period
            isAlreadyExists = Array.from(existingKeys).some(k => {
              const [mkIdStr, taStr] = k.split('_')
              if (Number(mkIdStr) !== mk.id) return false
              if (!taStr) return true
              return taStr.includes(targetPeriodLower) || targetPeriodLower.includes(taStr)
            })
          } else {
            isAlreadyExists = existingMkIds.has(mk.id)
          }
        }

        if (isAlreadyExists) {
          skipped.push({ kode: mk.kode, nama: mk.nama })
        } else {
          toProcess.push(mk)
        }
      }

      const maxPasses = bulkConfig.auto_retry ? Math.max(1, bulkConfig.max_retries || 3) : 1
      let currentBatch = [...toProcess]

      // 3. Multi-Pass Automated Loop
      for (let pass = 1; pass <= maxPasses; pass++) {
        if (bulkStopRef.current || currentBatch.length === 0) break

        const passErrors: any[] = []
        const nextFailedQueue: any[] = []

        const passTitle = pass === 1
          ? `Pass 1 (Utama)`
          : `Pass ${pass} (Auto-Retry ${currentBatch.length} Gagal)`

        for (let i = 0; i < currentBatch.length; i++) {
          if (bulkStopRef.current) {
            setBulkStopped(true)
            break
          }

          const mk = currentBatch[i]
          setBulkProgress({
            currentPass: pass,
            maxPasses,
            current: done.length + skipped.length + i + 1,
            total: allMkList.length,
            currentName: mk.nama,
            statusMessage: `${passTitle} — ${mk.nama}`,
            done: [...done],
            errors: [...passErrors],
            skipped: [...skipped],
          })

          try {
            const res = await api.post('/api/v1/generate/rps-one', {
              mata_kuliah_id: mk.id,
              prodi_id: mk.prodi_id,
              semester: mk.semester,
              tahun_akademik: bulkConfig.tahun_akademik || '2025/2026',
              additional_context: bulkConfig.additional_context || '',
              dosen_pengampu: [],
            })
            done.push({
              kode: mk.kode,
              nama: mk.nama,
              rps_id: res.data.rps_id,
              sdgs: res.data.sdgs || [],
              bloom_updated: res.data.bloom_updated,
            })
          } catch (e: any) {
            const errMsg = e.response?.data?.detail || e.message || 'Gagal generate'
            const errObj = { id: mk.id, kode: mk.kode, nama: mk.nama, prodi_id: mk.prodi_id, semester: mk.semester, error: errMsg }
            passErrors.push(errObj)
            nextFailedQueue.push(mk)
          }

          setBulkProgress({
            currentPass: pass,
            maxPasses,
            current: done.length + skipped.length + (i + 1),
            total: allMkList.length,
            currentName: mk.nama,
            statusMessage: `${passTitle} — ${mk.nama}`,
            done: [...done],
            errors: [...passErrors],
            skipped: [...skipped],
          })
        }

        failedQueue = nextFailedQueue

        // If no items failed or stop was requested, loop finishes
        if (failedQueue.length === 0 || bulkStopRef.current) {
          break
        }

        // If we have retries left, pause briefly before next pass
        if (pass < maxPasses && bulkConfig.auto_retry) {
          setBulkProgress(prev => prev ? {
            ...prev,
            statusMessage: `⏸ Cooldown... Mengulang ${failedQueue.length} item gagal pada Loop ${pass + 1}...`
          } : prev)
          await new Promise(r => setTimeout(r, 1500))
        }

        currentBatch = [...failedQueue]
      }

      // 4. Finished all loops
      setBulkProgress(prev => prev ? {
        ...prev,
        currentName: '',
        statusMessage: bulkStopRef.current ? '⏹ Proses dihentikan oleh pengguna.' : '✅ Seluruh siklus bulk RPS telah selesai.'
      } : prev)

      if (failedQueue.length === 0) {
        toast.success(`Selesai! ${done.length} RPS berhasil dibuat, ${skipped.length} dilewati.`)
      } else {
        toast.error(`Selesai dengan ${failedQueue.length} item gagal setelah ${maxPasses} pass retry.`)
      }
      loadData()
    } catch (e: any) {
      toast.error(e.response?.data?.detail || e.message || 'Gagal bulk generate RPS')
    } finally {
      setBulkGenerating(false)
    }
  }

  async function loadData() {
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.append('status', statusFilter)
      if (prodiFilter) params.append('prodi_id', prodiFilter)
      params.append('size', '50')
      const res = await api.get(`/api/v1/rps/?${params.toString()}`)
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
      const contentType = (res.headers['content-type'] as string) || ''
      const blob = new Blob([res.data], { type: contentType })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      
      let ext = format
      if (format === 'pdf' && contentType.includes('text/html')) {
        ext = 'html'
        toast.error('xhtml2pdf tidak terinstall di server. File diunduh sebagai HTML.', { duration: 5000 })
      }
      
      a.download = `RPS-${id}.${ext}`
      a.click()
      window.URL.revokeObjectURL(url)
      
      if (ext === format) {
        toast.success(`Berhasil export ${format.toUpperCase()}`)
      }
    } catch (e) {
      toast.error('Gagal export')
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Apakah Anda yakin ingin menghapus RPS ini secara permanen?')) return
    try {
      await api.delete(`/api/v1/rps/${id}`)
      toast.success('RPS berhasil dihapus')
      loadData()
    } catch {
      toast.error('Gagal menghapus RPS')
    }
  }

  const filtered = rpsList.filter((r) => {
    if (periodeFilter) {
      const ta = r.tahun_akademik || r.identitas?.tahun_akademik || ''
      const matchTa = ta.toLowerCase().includes(periodeFilter.toLowerCase()) ||
                      periodeFilter.toLowerCase().includes(ta.toLowerCase())
      if (!matchTa) return false
    }

    if (!search) return true
    const searchLower = search.toLowerCase()
    const code = r.kode || ''
    const mk = r.identitas?.nama_mata_kuliah || ''
    const prodiObj = prodis.find((p) => p.id === r.prodi_id)
    const prodiName = prodiObj?.nama || r.identitas?.prodi || ''
    const matchKode = code.toLowerCase().includes(searchLower)
    const matchMK = mk.toLowerCase().includes(searchLower)
    const matchProdi = prodiName.toLowerCase().includes(searchLower)
    let matchDosen = false
    if (Array.isArray(r.dosen_pengampu)) {
      matchDosen = r.dosen_pengampu.some((d: any) => {
        const name = typeof d === 'string' ? d : (d?.nama || '')
        return name.toLowerCase().includes(searchLower)
      })
    } else if (typeof r.dosen_pengampu === 'string') {
      matchDosen = r.dosen_pengampu.toLowerCase().includes(searchLower)
    }
    return matchKode || matchMK || matchDosen || matchProdi
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Cari berdasarkan mata kuliah, dosen, prodi, atau kode..." value={search} onChange={(e) => setSearch(e.target.value)} className="macos-input pl-10" />
        </div>
        <select value={prodiFilter} onChange={(e) => setProdiFilter(e.target.value)} className="macos-input max-w-[220px]">
          <option value="">Semua Program Studi</option>
          {prodis.map((p) => (
            <option key={p.id} value={p.id}>{p.nama} ({p.kode})</option>
          ))}
        </select>
        <select value={periodeFilter} onChange={(e) => setPeriodeFilter(e.target.value)} className="macos-input max-w-[200px]">
          <option value="">Semua Periode</option>
          {periodes.map((p) => (
            <option key={p.id} value={p.nama}>
              {p.nama} {p.is_active ? '(Aktif)' : ''}
            </option>
          ))}
        </select>
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
            let dosenNames = '-'
            if (Array.isArray(rps.dosen_pengampu)) {
              const names = rps.dosen_pengampu.map((d: any) => typeof d === 'string' ? d : (d?.nama || '')).filter(Boolean)
              if (names.length > 0) dosenNames = names.join(', ')
            } else if (typeof rps.dosen_pengampu === 'string' && rps.dosen_pengampu.trim()) {
              dosenNames = rps.dosen_pengampu
            }
            const prodiObj = prodis.find((p) => p.id === rps.prodi_id)
            const prodiName = prodiObj?.nama || rps.identitas?.prodi || ''
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
                    Kode: {rps.kode} {prodiName && `· ${prodiName}`} · Semester {rps.semester} · {rps.tahun_akademik}
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
                  {isAdmin && (
                    <button onClick={() => handleDelete(rps.id)} className="macos-button-ghost px-2.5 py-1.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50" title="Hapus RPS">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Bulk Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="macos-card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-up space-y-5 bg-white/95 shadow-2xl rounded-apple-xl border border-white/20">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-50 rounded-apple-lg">
                <Sparkles className="w-5 h-5 text-purple-500 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Bulk Generate RPS</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Generate RPS satu per satu secara berurutan (pipeline).</p>
              </div>
            </div>

            {/* Config form — hide while running */}
            {!bulkGenerating && !bulkProgress && (
              <div className="space-y-3.5 pt-2">
                <div>
                  <label className="macos-label">Pilih Program Studi *</label>
                  <select
                    className="macos-input"
                    value={bulkConfig.prodi_id}
                    onChange={(e) => setBulkConfig({ ...bulkConfig, prodi_id: e.target.value })}
                    required
                  >
                    <option value="all">⚡ Semua Program Studi (Otomatis Sweep Semua)</option>
                    {prodis.map((p) => (
                      <option key={p.id} value={p.id}>{p.nama} ({p.kode})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="macos-label">Tahun Akademik / Periode</label>
                  <select
                    className="macos-input"
                    value={bulkConfig.tahun_akademik}
                    onChange={(e) => setBulkConfig({ ...bulkConfig, tahun_akademik: e.target.value })}
                  >
                    <option value="">-- Pilih dari Periode Master --</option>
                    {periodes.map((p) => (
                      <option key={p.id} value={p.tahun_akademik || p.nama}>
                        {p.nama} {p.is_active ? '(Aktif)' : ''}
                      </option>
                    ))}
                  </select>
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
                  <p className="text-[10px] text-gray-400 mt-1">Kosongkan untuk semua semester.</p>
                </div>
                <div>
                  <label className="macos-label">Konteks Tambahan (Opsional)</label>
                  <textarea
                    className="macos-input min-h-[60px] resize-none"
                    value={bulkConfig.additional_context}
                    onChange={(e) => setBulkConfig({ ...bulkConfig, additional_context: e.target.value })}
                    placeholder="Informasi tambahan untuk membimbing AI..."
                  />
                </div>

                <div className="p-3 bg-indigo-50/60 rounded-apple-lg border border-indigo-100/80 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={bulkConfig.skip_existing}
                      onChange={e => setBulkConfig({ ...bulkConfig, skip_existing: e.target.checked })}
                      className="w-4 h-4 accent-indigo-600 rounded"
                    />
                    <span className="text-xs font-medium text-gray-800">Lewati mata kuliah yang sudah ada RPS-nya</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={bulkConfig.auto_retry}
                      onChange={e => setBulkConfig({ ...bulkConfig, auto_retry: e.target.checked })}
                      className="w-4 h-4 accent-indigo-600 rounded"
                    />
                    <span className="text-xs font-medium text-gray-800">Sistem Looping Retries (Otomatis ulang yang gagal)</span>
                  </label>

                  {bulkConfig.auto_retry && (
                    <div className="flex items-center gap-2 pt-1 pl-6">
                      <span className="text-[11px] text-gray-600">Batas Maksimal Loop Retry:</span>
                      <select
                        className="macos-input py-1 px-2 text-xs w-28"
                        value={bulkConfig.max_retries}
                        onChange={(e) => setBulkConfig({ ...bulkConfig, max_retries: parseInt(e.target.value) })}
                      >
                        <option value={2}>2 Pass (Retry 1x)</option>
                        <option value={3}>3 Pass (Retry 2x)</option>
                        <option value={5}>5 Pass (Retry 4x)</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Progress view */}
            {bulkProgress && (
              <div className="space-y-4">
                {/* Progress Header */}
                <div>
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-1.5 flex-wrap gap-1">
                    <span className="font-semibold text-indigo-900 truncate">
                      {bulkProgress.statusMessage || 'Processing...'}
                    </span>
                    <span className="font-mono text-[11px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                      Pass {bulkProgress.currentPass}/{bulkProgress.maxPasses}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-2.5 rounded-full bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 transition-all duration-300"
                      style={{ width: `${Math.min(100, (bulkProgress.current / (bulkProgress.total || 1)) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 text-right">
                    Kemajuan Total: {bulkProgress.current} dari {bulkProgress.total} MK
                  </p>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-green-50 rounded-apple p-2">
                    <p className="text-lg font-bold text-green-600">{bulkProgress.done.length}</p>
                    <p className="text-[10px] text-green-500">RPS Dibuat</p>
                  </div>
                  <div className="bg-yellow-50 rounded-apple p-2">
                    <p className="text-lg font-bold text-yellow-600">{bulkProgress.skipped.length}</p>
                    <p className="text-[10px] text-yellow-500">Dilewati</p>
                  </div>
                  <div className="bg-red-50 rounded-apple p-2">
                    <p className="text-lg font-bold text-red-600">{bulkProgress.errors.length}</p>
                    <p className="text-[10px] text-red-500">Gagal</p>
                  </div>
                </div>

                {/* SDGs + Bloom mini summary */}
                {bulkProgress.done.length > 0 && (
                  <div className="flex items-center gap-3 text-xs text-gray-500 bg-gray-50 rounded-apple px-3 py-2">
                    <span>🌍 SDGs terdeteksi: <strong className="text-blue-600">{bulkProgress.done.filter((d: any) => d.sdgs?.length > 0).length}</strong> MK</span>
                    <span className="text-gray-300">|</span>
                    <span>🎯 Bloom diperbaiki: <strong className="text-indigo-600">{bulkProgress.done.filter((d: any) => d.bloom_updated).length}</strong> MK</span>
                  </div>
                )}

                {/* Done list */}
                {bulkProgress.done.length > 0 && (
                  <div className="max-h-28 overflow-y-auto space-y-1">
                    {bulkProgress.done.map((d: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                        <span className="text-green-500 flex-shrink-0">✓</span>
                        <span className="font-mono text-gray-400 flex-shrink-0">{d.kode}</span>
                        <span className="flex-1 truncate">{d.nama}</span>
                        {d.sdgs?.length > 0 && (
                          <span className="text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full flex-shrink-0">
                            {d.sdgs.length} SDG
                          </span>
                        )}
                        {d.bloom_updated && (
                          <span className="text-[10px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded-full flex-shrink-0">
                            Bloom ✓
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Error detail */}
                {bulkProgress.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-100 rounded-apple p-3 max-h-28 overflow-y-auto">
                    {bulkProgress.errors.map((e: any, i: number) => (
                      <p key={i} className="text-xs text-red-600 mb-1">
                        <span className="font-mono font-medium">{e.kode}</span> {e.nama}: {e.error}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              {!bulkGenerating && (
                <button
                  onClick={() => { setShowBulkModal(false); setBulkProgress(null); setBulkStopped(false) }}
                  className="macos-button-ghost px-4 py-2 text-xs"
                >
                  {bulkProgress ? 'Tutup' : 'Batal'}
                </button>
              )}
              {bulkGenerating ? (
                <button
                  onClick={() => { bulkStopRef.current = true }}
                  className="macos-button py-2.5 px-4 flex items-center gap-2 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white font-medium text-xs rounded-apple-lg"
                >
                  ⏹ Stop
                </button>
              ) : !bulkProgress ? (
                <button
                  onClick={handleBulkGenerate}
                  disabled={!bulkConfig.prodi_id}
                  className="macos-button py-2.5 px-4 flex items-center gap-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-medium text-xs rounded-apple-lg disabled:from-gray-300 disabled:to-gray-400"
                >
                  <Sparkles className="w-4 h-4" /> Mulai Generate
                </button>
              ) : (
                <button
                  onClick={() => { setBulkProgress(null); setBulkStopped(false) }}
                  className="macos-button py-2.5 px-4 flex items-center gap-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-medium text-xs rounded-apple-lg"
                >
                  <Sparkles className="w-4 h-4" /> Generate Lagi
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}