import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Search, Filter, CheckCircle, Clock, AlertCircle, Download, Sparkles, Trash2, Copy, Loader2, ArrowRight, Calendar, FileSpreadsheet, Upload, RefreshCw, FileUp, CheckCheck, X, Globe, Send, CheckCircle2, BookOpen } from 'lucide-react'
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
  const { isAdmin, canEditRPS } = useAuth()
  const [rpsList, setRpsList] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [contentFilter, setContentFilter] = useState<'all' | 'empty' | 'filled'>('all')
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

  const [bulkConfig, setBulkConfig] = useState<{
    target_type: 'empty_rps' | 'all_mk'
    prodi_id: string
    tahun_akademik: string
    semester: string
    filter_mk_periode: string
    additional_context: string
    skip_existing: boolean
    auto_retry: boolean
    max_retries: number
  }>({
    target_type: 'empty_rps',
    prodi_id: 'all',
    tahun_akademik: '2025/2026',
    semester: '',
    filter_mk_periode: 'all',
    additional_context: '',
    skip_existing: true,
    auto_retry: true,
    max_retries: 3,
  })

  // Selected RPS for Bulk Action State
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [showSelectedCopyModal, setShowSelectedCopyModal] = useState(false)
  const [selectedCopyPeriode, setSelectedCopyPeriode] = useState('')
  const [selectedCopyStatus, setSelectedCopyStatus] = useState('draft')
  const [selectedCopySkip, setSelectedCopySkip] = useState(true)
  const [selectedCopying, setSelectedCopying] = useState(false)

  // Schedule / Jadwal Sync Modal State
  const [showJadwalModal, setShowJadwalModal] = useState(false)
  const [jadwalTargetPeriode, setJadwalTargetPeriode] = useState('')
  const [jadwalProdiId, setJadwalProdiId] = useState('all')
  const [jadwalFile, setJadwalFile] = useState<File | null>(null)
  const [jadwalRawText, setJadwalRawText] = useState('')
  const [jadwalInputMode, setJadwalInputMode] = useState<'upload' | 'paste'>('upload')
  const [jadwalParsing, setJadwalParsing] = useState(false)
  const [jadwalExtracted, setJadwalExtracted] = useState<any[]>([])
  const [jadwalSyncing, setJadwalSyncing] = useState(false)
  const [jadwalSyncResult, setJadwalSyncResult] = useState<any>(null)
  const [jadwalSearch, setJadwalSearch] = useState('')
  const [jadwalAutoCreate, setJadwalAutoCreate] = useState(true)
  const [jadwalTargetStatus, setJadwalTargetStatus] = useState<'published' | 'draft'>('published')
  const [jadwalAutoUpdateSemester, setJadwalAutoUpdateSemester] = useState(true)

  // Bulk Publish Modal State
  const [showBulkPublishModal, setShowBulkPublishModal] = useState(false)
  const [bulkPublishPeriode, setBulkPublishPeriode] = useState('')
  const [bulkPublishProdiId, setBulkPublishProdiId] = useState('all')
  const [bulkPublishOnlyWithDosen, setBulkPublishOnlyWithDosen] = useState(true)
  const [bulkPublishing, setBulkPublishing] = useState(false)

  async function openBulkPublishModal() {
    if (prodis.length === 0) await loadProdis()
    if (periodes.length === 0) await loadPeriodes()
    const act = periodes.find(p => p.is_active)
    setBulkPublishPeriode(periodeFilter || act?.nama || (periodes[0]?.nama || ''))
    setBulkPublishProdiId(prodiFilter || 'all')
    setBulkPublishOnlyWithDosen(true)
    setShowBulkPublishModal(true)
  }

  async function handleBulkPublishSubmit() {
    setBulkPublishing(true)
    try {
      const payload = {
        target_tahun_akademik: bulkPublishPeriode === 'all' || !bulkPublishPeriode ? null : bulkPublishPeriode.trim(),
        prodi_id: bulkPublishProdiId === 'all' ? null : bulkPublishProdiId,
        only_with_dosen: bulkPublishOnlyWithDosen,
      }
      const res = await api.post('/api/v1/rps/bulk-publish', payload)
      toast.success(res.data.message || `Berhasil mempublikasikan ${res.data.published_count} RPS!`)
      setShowBulkPublishModal(false)
      loadData()
    } catch (e: any) {
      toast.error(e.response?.data?.detail || e.message || 'Gagal mempublikasikan RPS')
    } finally {
      setBulkPublishing(false)
    }
  }

  async function handlePublishSelected() {
    if (selectedIds.size === 0) return
    if (!confirm(`Apakah Anda yakin ingin mempublikasikan (set status Published) untuk ${selectedIds.size} RPS terpilih?`)) {
      return
    }
    try {
      const payload = {
        rps_ids: Array.from(selectedIds),
        only_with_dosen: false,
      }
      const res = await api.post('/api/v1/rps/bulk-publish', payload)
      toast.success(res.data.message || `Berhasil mempublikasikan ${res.data.published_count} RPS!`)
      setSelectedIds(new Set())
      loadData()
    } catch (e: any) {
      toast.error(e.response?.data?.detail || e.message || 'Gagal mempublikasikan RPS terpilih')
    }
  }

  const [generatingSelectedAI, setGeneratingSelectedAI] = useState(false)

  async function handleGenerateSelectedAI() {
    if (selectedIds.size === 0) return
    if (!confirm(`Apakah Anda yakin ingin meminta AI membuatkan silabus & capaian pembelajaran lengkap untuk ${selectedIds.size} RPS terpilih?`)) {
      return
    }

    setGeneratingSelectedAI(true)
    const list = Array.from(selectedIds)
    let successCount = 0
    let failCount = 0
    const toastId = toast.loading(`[1/${list.length}] Memulai antrian AI...`)

    for (let i = 0; i < list.length; i++) {
      const rpsId = list[i]
      toast.loading(`[${i + 1}/${list.length}] AI sedang merancang RPS...`, { id: toastId })
      try {
        const startRes = await api.post(`/api/v1/generate/async/rps/${rpsId}`, { additional_context: '' })
        const taskId = startRes.data.task_id

        // Poll task
        let done = false
        for (let attempt = 0; attempt < 300; attempt++) {
          await new Promise((r) => setTimeout(r, 2000))
          const pollRes = await api.get(`/api/v1/generate/task/${taskId}`)
          if (pollRes.data.status === 'completed') {
            done = true
            break
          }
          if (pollRes.data.status === 'failed') {
            throw new Error(pollRes.data.error || 'Gagal generate AI')
          }
          if (pollRes.data.progress) {
            toast.loading(`[${i + 1}/${list.length}] ${pollRes.data.progress}`, { id: toastId })
          }
        }
        if (done) successCount++
        else failCount++
      } catch (e) {
        failCount++
      }
    }

    if (failCount === 0) {
      toast.success(`Berhasil! AI telah melengkapi ${successCount} RPS terpilih.`, { id: toastId })
    } else {
      toast.error(`Selesai: ${successCount} berhasil di-generate, ${failCount} gagal.`, { id: toastId })
    }

    setGeneratingSelectedAI(false)
    setSelectedIds(new Set())
    loadData()
  }

  async function openJadwalModal() {
    if (prodis.length === 0) await loadProdis()
    if (periodes.length === 0) await loadPeriodes()
    const act = periodes.find(p => p.is_active)
    setJadwalTargetPeriode(periodeFilter || act?.nama || (periodes[0]?.nama || '2025/2026 Genap'))
    setJadwalProdiId(prodiFilter || 'all')
    setJadwalFile(null)
    setJadwalRawText('')
    setJadwalExtracted([])
    setJadwalSyncResult(null)
    setJadwalSearch('')
    setJadwalAutoCreate(true)
    setJadwalTargetStatus('published')
    setJadwalAutoUpdateSemester(true)
    setShowJadwalModal(true)
  }

  function normalizePeriodStr(s?: string): string {
    if (!s) return ''
    return s.toLowerCase().replace(/[^a-z0-9]/g, '')
  }

  useEffect(() => {
    loadProdis()
    loadPeriodes()
  }, [])

  useEffect(() => {
    loadData()
  }, [statusFilter, prodiFilter])

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
        setBulkConfig(prev => ({ ...prev, tahun_akademik: act.nama || act.tahun_akademik }))
      }
    } catch (e) {
      console.error('Gagal memuat periode list', e)
    }
  }

  // Single Copy Modal State
  const [showSingleCopyModal, setShowSingleCopyModal] = useState(false)
  const [copyTargetRps, setCopyTargetRps] = useState<any>(null)
  const [singleCopyPeriode, setSingleCopyPeriode] = useState('')
  const [singleCopyStatus, setSingleCopyStatus] = useState('draft')
  const [singleCopying, setSingleCopying] = useState(false)

  // Bulk Copy Modal State
  const [showBulkCopyModal, setShowBulkCopyModal] = useState(false)
  const [bulkCopyConfig, setBulkCopyConfig] = useState({
    source_tahun_akademik: '',
    target_tahun_akademik: '',
    prodi_id: 'all',
    statuses: ['draft', 'review', 'approved', 'published'],
    target_status: 'draft',
    skip_existing: true,
  })
  const [bulkCopying, setBulkCopying] = useState(false)
  const [bulkCopyResult, setBulkCopyResult] = useState<any>(null)

  function openSingleCopyModal(rpsItem: any) {
    setCopyTargetRps(rpsItem)
    const act = periodes.find(p => p.is_active)
    setSingleCopyPeriode(act?.nama || act?.tahun_akademik || '')
    setSingleCopyStatus('draft')
    setShowSingleCopyModal(true)
  }

  async function handleSingleCopySubmit() {
    if (!copyTargetRps || !singleCopyPeriode.trim()) {
      toast.error('Pilih atau masukkan periode target')
      return
    }
    setSingleCopying(true)
    try {
      const res = await api.post(`/api/v1/rps/${copyTargetRps.id}/copy`, {
        target_tahun_akademik: singleCopyPeriode.trim(),
        target_status: singleCopyStatus,
      })
      toast.success(`RPS berhasil disalin ke periode '${singleCopyPeriode}'!`)
      setShowSingleCopyModal(false)
      loadData()
    } catch (e: any) {
      toast.error(e.response?.data?.detail || e.message || 'Gagal menyalin RPS')
    } finally {
      setSingleCopying(false)
    }
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(r => r.id)))
    }
  }

  function toggleSelectOne(id: number) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  function openSelectedCopy() {
    if (selectedIds.size === 0) {
      toast.error('Pilih minimal 1 RPS terlebih dahulu')
      return
    }
    const act = periodes.find(p => p.is_active)
    setSelectedCopyPeriode(act?.nama || act?.tahun_akademik || '')
    setSelectedCopyStatus('draft')
    setSelectedCopySkip(true)
    setShowSelectedCopyModal(true)
  }

  async function handleSelectedCopySubmit() {
    if (!selectedCopyPeriode.trim()) {
      toast.error('Pilih atau masukkan periode target')
      return
    }
    setSelectedCopying(true)
    try {
      const res = await api.post('/api/v1/rps/copy-selected', {
        rps_ids: Array.from(selectedIds),
        target_tahun_akademik: selectedCopyPeriode.trim(),
        target_status: selectedCopyStatus,
        skip_existing: selectedCopySkip,
      })
      if (res.data.copied > 0) {
        toast.success(`Berhasil menyalin ${res.data.copied} RPS terpilih ke periode '${selectedCopyPeriode}'!`)
      } else {
        toast.error(`0 RPS disalin (${res.data.skipped} dilewati, ${res.data.errors} gagal)`)
      }
      setShowSelectedCopyModal(false)
      setSelectedIds(new Set())
      loadData()
    } catch (e: any) {
      toast.error(e.response?.data?.detail || e.message || 'Gagal menyalin RPS terpilih')
    } finally {
      setSelectedCopying(false)
    }
  }

  async function handleParseJadwal() {
    if (jadwalInputMode === 'upload' && !jadwalFile) {
      toast.error('Pilih file Excel (.xlsx) atau CSV terlebih dahulu')
      return
    }
    if (jadwalInputMode === 'paste' && !jadwalRawText.trim()) {
      toast.error('Masukkan atau paste teks tabel jadwal terlebih dahulu')
      return
    }

    setJadwalParsing(true)
    setJadwalExtracted([])
    setJadwalSyncResult(null)

    try {
      const formData = new FormData()
      if (jadwalInputMode === 'upload' && jadwalFile) {
        formData.append('file', jadwalFile)
      } else {
        formData.append('raw_text', jadwalRawText)
      }

      const res = await api.post('/api/v1/rps/parse-jadwal', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      const list = res.data || []
      setJadwalExtracted(list)
      if (list.length > 0) {
        toast.success(`Berhasil mengekstrak ${list.length} mata kuliah dari jadwal!`)
      } else {
        toast.error('Tidak ada data mata kuliah yang ditemukan pada file tersebut')
      }
    } catch (e: any) {
      toast.error(e.response?.data?.detail || e.message || 'Gagal memproses file jadwal')
    } finally {
      setJadwalParsing(false)
    }
  }

  async function handleSyncJadwalSubmit() {
    if (!jadwalTargetPeriode.trim()) {
      toast.error('Pilih atau masukkan periode target sinkronisasi')
      return
    }
    if (jadwalExtracted.length === 0) {
      toast.error('Ekstrak file jadwal terlebih dahulu')
      return
    }

    setJadwalSyncing(true)
    try {
      const payload = {
        target_tahun_akademik: jadwalTargetPeriode.trim(),
        prodi_id: jadwalProdiId === 'all' ? null : jadwalProdiId,
        items: jadwalExtracted,
        auto_create_rps_draft: jadwalAutoCreate,
        target_status: jadwalTargetStatus,
        auto_update_semester: jadwalAutoUpdateSemester,
      }
      const res = await api.post('/api/v1/rps/sync-jadwal-dosen', payload)
      setJadwalSyncResult(res.data)
      if (res.data.updated_rps > 0) {
        toast.success(`Berhasil menyinkronkan dosen pada ${res.data.updated_rps} RPS untuk periode '${jadwalTargetPeriode}'!`)
      } else {
        toast.error(`Tidak ada RPS yang diperbarui (${res.data.not_found_rps} RPS belum dibuat / tidak cocok)`)
      }
      loadData()
    } catch (e: any) {
      toast.error(e.response?.data?.detail || e.message || 'Gagal sinkronisasi dosen jadwal')
    } finally {
      setJadwalSyncing(false)
    }
  }

  function downloadJadwalTemplate(type: 'simple' | 'siakad' = 'simple') {
    let csvContent = ''
    let filename = 'Template_Jadwal_Dosen_Standar.csv'

    if (type === 'siakad') {
      filename = 'Template_Jadwal_Format_SIAKAD.csv'
      csvContent = "No,Hari,Jam Mulai,Jam Selesai,Ruangan,Kode MK,Nama Mata Kuliah,SKS,Semester,Kurikulum,Dosen Pengampu,Dosen Team Teaching,Jenis Kelas,Kuota,Terisi,Status\n" +
        "1,SENIN,07:30,10:00,B205,3KA102,PENGANTAR AKUNTANSI 2,3,2,MANAJEMEN GENAP 2025/2026,SURIANTO,-,REGULER,40,28,Aktif\n" +
        "2,SENIN,08:30,10:30,A303,2KB001,Bahasa Inggris,3,4,TEKNIK INDUSTRI GENAP 2025/2026,A. IMAM ZULFIKAR MUSTAMAN,-,REGULER,30,11,Aktif\n" +
        "3,SELASA,10:00,12:30,B301,3KP211,STATISTIKA BISNIS,3,4,MANAJEMEN GENAP 2025/2026,PERDY KARURU,Muh. Arifai,REGULER,41,41,Aktif\n"
    } else {
      filename = 'Template_Jadwal_Dosen_Sederhana.csv'
      csvContent = "KODE_MK,NAMA_MATA_KULIAH,PROGRAM_STUDI,SEMESTER,SKS,KELAS,DOSEN_PENGAMPU,DOSEN_TEAM_TEACHING\n" +
        "TI101,Pemrograman Web,Teknik Informatika,3,3,A,Dr. Budi Santoso M.Kom.,-\n" +
        "TI101,Pemrograman Web,Teknik Informatika,3,3,B,Siti Rahma M.Cs.,-\n" +
        "3KA102,PENGANTAR AKUNTANSI 2,MANAJEMEN,2,3,REGULER,SURIANTO,BASO R\n"
    }

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(`Template ${type === 'siakad' ? 'SIAKAD' : 'Sederhana'} berhasil diunduh!`)
  }

  async function openBulkCopy() {
    if (prodis.length === 0) await loadProdis()
    if (periodes.length === 0) await loadPeriodes()
    const act = periodes.find(p => p.is_active)
    
    // Choose sensible default source period from filter or existing RPS data
    let src = periodeFilter
    if (!src) {
      const distinctInRps = Array.from(new Set(rpsList.map(r => r.tahun_akademik || r.identitas?.tahun_akademik).filter(Boolean)))
      src = distinctInRps[0] || (periodes[0]?.nama || '')
    }

    setBulkCopyConfig({
      source_tahun_akademik: src,
      target_tahun_akademik: act?.nama || '',
      prodi_id: prodiFilter || 'all',
      statuses: ['draft', 'review', 'approved', 'published'],
      target_status: 'draft',
      skip_existing: true,
    })
    setBulkCopyResult(null)
    setShowBulkCopyModal(true)
  }

  async function handleBulkCopySubmit() {
    if (!bulkCopyConfig.source_tahun_akademik || !bulkCopyConfig.target_tahun_akademik) {
      toast.error('Pilih periode sumber dan periode target')
      return
    }
    if (bulkCopyConfig.source_tahun_akademik === bulkCopyConfig.target_tahun_akademik) {
      toast.error('Periode sumber dan target tidak boleh sama')
      return
    }
    setBulkCopying(true)
    try {
      const res = await api.post('/api/v1/rps/bulk-copy', {
        source_tahun_akademik: bulkCopyConfig.source_tahun_akademik,
        target_tahun_akademik: bulkCopyConfig.target_tahun_akademik,
        prodi_id: bulkCopyConfig.prodi_id === 'all' ? null : bulkCopyConfig.prodi_id,
        statuses: bulkCopyConfig.statuses,
        target_status: bulkCopyConfig.target_status,
        skip_existing: bulkCopyConfig.skip_existing,
      })
      setBulkCopyResult(res.data)
      if (res.data.copied > 0) {
        toast.success(`Berhasil menyalin ${res.data.copied} RPS ke periode '${bulkCopyConfig.target_tahun_akademik}'!`)
      } else {
        toast.error(`Tidak ada RPS yang disalin (${res.data.skipped} dilewati, ${res.data.errors} error)`)
      }
      loadData()
    } catch (e: any) {
      toast.error(e.response?.data?.detail || e.message || 'Gagal bulk copy RPS')
    } finally {
      setBulkCopying(false)
    }
  }

  async function openBulkModal() {
    if (prodis.length === 0) await loadProdis()
    if (periodes.length === 0) await loadPeriodes()
    const act = periodes.find(p => p.is_active)
    setBulkConfig(prev => ({
      ...prev,
      target_type: 'empty_rps',
      prodi_id: prodiFilter || 'all',
      tahun_akademik: periodeFilter || act?.nama || (periodes[0]?.nama || '2025/2026 Genap'),
    }))
    setShowBulkModal(true)
  }

  async function handleBulkGenerate() {
    setBulkGenerating(true)
    bulkStopRef.current = false
    setBulkStopped(false)
    setBulkProgress(null)

    try {
      if (bulkConfig.target_type === 'empty_rps') {
        // Mode 1: Sweep and fill existing empty RPS records
        let rpsUrl = `/api/v1/rps/?size=1000&limit=1000`
        if (bulkConfig.prodi_id && bulkConfig.prodi_id !== 'all') {
          rpsUrl += `&prodi_id=${bulkConfig.prodi_id}`
        }
        if (bulkConfig.semester) {
          rpsUrl += `&semester=${bulkConfig.semester}`
        }
        const rpsRes = await api.get(rpsUrl)
        const allRpsInDb: any[] = rpsRes.data.items || []

        const targetPeriodNorm = normalizePeriodStr(bulkConfig.tahun_akademik)

        const emptyRpsList = allRpsInDb.filter(r => {
          if (targetPeriodNorm) {
            const ta = normalizePeriodStr(r.tahun_akademik || r.identitas?.tahun_akademik)
            if (!ta.includes(targetPeriodNorm) && !targetPeriodNorm.includes(ta)) return false
          }
          return isRpsEmpty(r)
        })

        if (emptyRpsList.length === 0) {
          toast.success(`Semua RPS pada kriteria ini sudah memiliki materi/silabus lengkap. Tidak ada RPS kosong yang perlu diisi.`)
          setBulkGenerating(false)
          return
        }

        const maxPasses = bulkConfig.auto_retry ? Math.max(1, bulkConfig.max_retries || 3) : 1
        let currentBatch = [...emptyRpsList]
        const done: any[] = []
        let failedQueue: any[] = []

        for (let pass = 1; pass <= maxPasses; pass++) {
          if (bulkStopRef.current || currentBatch.length === 0) break

          const passErrors: any[] = []
          const nextFailedQueue: any[] = []
          const passTitle = pass === 1 ? `Pass 1 (Utama)` : `Pass ${pass} (Auto-Retry)`

          for (let i = 0; i < currentBatch.length; i++) {
            if (bulkStopRef.current) {
              setBulkStopped(true)
              break
            }

            const item = currentBatch[i]
            const mkName = item.identitas?.nama_mata_kuliah || item.kode || `RPS #${item.id}`
            setBulkProgress({
              currentPass: pass,
              maxPasses,
              current: done.length + i + 1,
              total: emptyRpsList.length,
              currentName: mkName,
              statusMessage: `${passTitle} [${i + 1}/${currentBatch.length}] — ${mkName}`,
              done: [...done],
              errors: [...passErrors],
              skipped: [],
            })

            try {
              const startRes = await api.post(`/api/v1/generate/async/rps/${item.id}`, {
                additional_context: bulkConfig.additional_context || '',
              })
              const taskId = startRes.data.task_id

              let isDone = false
              for (let attempt = 0; attempt < 300; attempt++) {
                if (bulkStopRef.current) break
                await new Promise(r => setTimeout(r, 2000))
                const pollRes = await api.get(`/api/v1/generate/task/${taskId}`)
                if (pollRes.data.status === 'completed') {
                  isDone = true
                  break
                }
                if (pollRes.data.status === 'failed') {
                  throw new Error(pollRes.data.error || 'Gagal generate AI')
                }
                if (pollRes.data.progress) {
                  setBulkProgress(prev => prev ? {
                    ...prev,
                    statusMessage: `${passTitle} [${i + 1}/${currentBatch.length}] — ${mkName} (${pollRes.data.progress})`
                  } : prev)
                }
              }

              if (isDone) {
                done.push({
                  kode: item.kode,
                  nama: mkName,
                  rps_id: item.id,
                })
              } else {
                throw new Error('Proses AI dibatalkan atau timeout')
              }
            } catch (e: any) {
              const errMsg = e.response?.data?.detail || e.message || 'Gagal generate'
              passErrors.push({
                id: item.id,
                kode: item.kode,
                nama: mkName,
                prodi_id: item.prodi_id,
                semester: item.semester,
                error: errMsg
              })
              nextFailedQueue.push(item)
            }

            setBulkProgress({
              currentPass: pass,
              maxPasses,
              current: done.length + (i + 1),
              total: emptyRpsList.length,
              currentName: mkName,
              statusMessage: `${passTitle} [${i + 1}/${currentBatch.length}] — ${mkName}`,
              done: [...done],
              errors: [...passErrors],
              skipped: [],
            })
          }

          failedQueue = nextFailedQueue
          if (failedQueue.length === 0 || bulkStopRef.current) break

          if (pass < maxPasses && bulkConfig.auto_retry) {
            setBulkProgress(prev => prev ? {
              ...prev,
              statusMessage: `⏸ Cooldown... Mengulang ${failedQueue.length} RPS gagal pada Loop ${pass + 1}...`
            } : prev)
            await new Promise(r => setTimeout(r, 1500))
          }
          currentBatch = [...failedQueue]
        }

        setBulkProgress(prev => prev ? {
          ...prev,
          currentName: '',
          statusMessage: bulkStopRef.current ? '⏹ Proses dihentikan oleh pengguna.' : '✅ Seluruh siklus bulk RPS telah selesai.'
        } : prev)

        if (failedQueue.length === 0) {
          toast.success(`Selesai! ${done.length} RPS berhasil dilengkapi silabusnya oleh AI.`)
        } else {
          toast.error(`Selesai: ${done.length} berhasil, ${failedQueue.length} RPS gagal setelah ${maxPasses} pass retry.`)
        }
        loadData()
        return
      }

      // Mode 2: Generate from Master Mata Kuliah
      let url = `/api/v1/mata-kuliah/?size=1000&limit=1000`
      if (bulkConfig.prodi_id && bulkConfig.prodi_id !== 'all') {
        url += `&prodi_id=${bulkConfig.prodi_id}`
      }
      if (bulkConfig.semester) {
        url += `&semester=${bulkConfig.semester}`
      }
      if (bulkConfig.filter_mk_periode && bulkConfig.filter_mk_periode !== 'all') {
        url += `&periode=${encodeURIComponent(bulkConfig.filter_mk_periode)}`
      }
      const mkRes = await api.get(url)
      const allMkList: any[] = mkRes.data.items || []

      if (allMkList.length === 0) {
        toast.error('Tidak ada mata kuliah ditemukan untuk kriteria ini')
        setBulkGenerating(false)
        return
      }

      const existingMap = new Map<number, Set<string>>()
      if (bulkConfig.skip_existing) {
        let rpsUrl = `/api/v1/rps/?size=1000&limit=1000`
        if (bulkConfig.prodi_id && bulkConfig.prodi_id !== 'all') {
          rpsUrl += `&prodi_id=${bulkConfig.prodi_id}`
        }
        const rpsRes = await api.get(rpsUrl)
        const existingRps: any[] = rpsRes.data.items || []
        for (const r of existingRps) {
          if (r.mata_kuliah_id) {
            if (!existingMap.has(r.mata_kuliah_id)) {
              existingMap.set(r.mata_kuliah_id, new Set())
            }
            const rTaNorm = normalizePeriodStr(r.tahun_akademik || r.identitas?.tahun_akademik)
            existingMap.get(r.mata_kuliah_id)!.add(rTaNorm)
          }
        }
      }

      const targetPeriodNorm = normalizePeriodStr(bulkConfig.tahun_akademik)

      const done: any[] = []
      const skipped: any[] = []
      let failedQueue: any[] = []

      const toProcess: any[] = []
      for (const mk of allMkList) {
        let isAlreadyExists = false
        if (bulkConfig.skip_existing && existingMap.has(mk.id)) {
          const periodsForMk = existingMap.get(mk.id)!
          if (targetPeriodNorm) {
            isAlreadyExists = periodsForMk.has(targetPeriodNorm)
          } else {
            isAlreadyExists = periodsForMk.size > 0
          }
        }

        if (isAlreadyExists) {
          skipped.push({ kode: mk.kode, nama: mk.nama })
        } else {
          toProcess.push(mk)
        }
      }

      if (toProcess.length === 0) {
        toast.success(`Semua ${allMkList.length} mata kuliah sudah memiliki RPS untuk periode '${bulkConfig.tahun_akademik}'. Tidak ada yang perlu di-generate.`)
        setBulkProgress({
          currentPass: 1,
          maxPasses: 1,
          current: allMkList.length,
          total: allMkList.length,
          currentName: '',
          statusMessage: `Semua ${allMkList.length} mata kuliah sudah memiliki RPS untuk periode '${bulkConfig.tahun_akademik}'.`,
          done: [],
          errors: [],
          skipped: [...skipped],
        })
        setBulkGenerating(false)
        return
      }

      const maxPasses = bulkConfig.auto_retry ? Math.max(1, bulkConfig.max_retries || 3) : 1
      let currentBatch = [...toProcess]

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
            statusMessage: `${passTitle} [${i + 1}/${currentBatch.length}] — ${mk.nama}`,
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
            let errMsg = e.response?.data?.detail || e.message || 'Gagal generate'
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
            statusMessage: `${passTitle} [${i + 1}/${currentBatch.length}] — ${mk.nama}`,
            done: [...done],
            errors: [...passErrors],
            skipped: [...skipped],
          })
        }

        failedQueue = nextFailedQueue
        if (failedQueue.length === 0 || bulkStopRef.current) break

        if (pass < maxPasses && bulkConfig.auto_retry) {
          setBulkProgress(prev => prev ? {
            ...prev,
            statusMessage: `⏸ Cooldown... Mengulang ${failedQueue.length} item gagal pada Loop ${pass + 1}...`
          } : prev)
          await new Promise(r => setTimeout(r, 1500))
        }

        currentBatch = [...failedQueue]
      }

      setBulkProgress(prev => prev ? {
        ...prev,
        currentName: '',
        statusMessage: bulkStopRef.current ? '⏹ Proses dihentikan oleh pengguna.' : '✅ Seluruh siklus bulk RPS telah selesai.'
      } : prev)

      if (failedQueue.length === 0) {
        toast.success(`Selesai! ${done.length} RPS berhasil dibuat, ${skipped.length} dilewati.`)
      } else {
        toast.error(`Selesai: ${done.length} berhasil, ${failedQueue.length} item gagal setelah ${maxPasses} pass retry.`)
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
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter) params.append('status', statusFilter)
      if (prodiFilter) params.append('prodi_id', prodiFilter)
      params.append('size', '1000')
      params.append('limit', '1000')
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

  function isRpsEmpty(r: any): boolean {
    const hasCpmk = Array.isArray(r.cpmk) && r.cpmk.length > 0
    const hasRencana = Array.isArray(r.rencana_pembelajaran) && r.rencana_pembelajaran.length > 0
    const hasDeskripsi = typeof r.deskripsi_mata_kuliah === 'string' && r.deskripsi_mata_kuliah.trim().length > 0
    const hasBahanKajian = Array.isArray(r.bahan_kajian) && r.bahan_kajian.length > 0
    return !hasCpmk && !hasRencana && !hasDeskripsi && !hasBahanKajian
  }

  const allAvailablePeriodes = Array.from(new Set([
    ...periodes.map(p => p.nama),
    ...rpsList.map(r => r.tahun_akademik || r.identitas?.tahun_akademik).filter(Boolean),
  ]))

  const filtered = rpsList.filter((r) => {
    if (periodeFilter) {
      const ta = r.tahun_akademik || r.identitas?.tahun_akademik || ''
      const matchTa = ta.toLowerCase().includes(periodeFilter.toLowerCase()) ||
                      periodeFilter.toLowerCase().includes(ta.toLowerCase())
      if (!matchTa) return false
    }

    if (contentFilter === 'empty' && !isRpsEmpty(r)) return false
    if (contentFilter === 'filled' && isRpsEmpty(r)) return false

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
        {canEditRPS && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={openJadwalModal}
              className="macos-button flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-3.5 py-2.5 rounded-apple-lg shadow-sm"
            >
              <Calendar className="w-4 h-4" /> Sinkron Dosen Jadwal
            </button>
            <button
              onClick={openBulkPublishModal}
              className="macos-button flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs px-3.5 py-2.5 rounded-apple-lg shadow-sm"
              title="Publish semua RPS berstatus Draft yang sudah memiliki dosen"
            >
              <Send className="w-4 h-4" /> Publish Massal
            </button>
            <button
              onClick={openBulkCopy}
              className="macos-button flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-3.5 py-2.5 rounded-apple-lg shadow-sm"
            >
              <Copy className="w-4 h-4" /> Salin Massal Periode
            </button>
            <button
              onClick={openBulkModal}
              className="macos-button flex items-center gap-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-medium text-xs px-3.5 py-2.5 rounded-apple-lg shadow-sm"
            >
              <Sparkles className="w-4 h-4" /> Bulk Generate RPS
            </button>
          </div>
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
        <select value={contentFilter} onChange={(e: any) => setContentFilter(e.target.value)} className="macos-input max-w-[200px]">
          <option value="all">Semua Kelengkapan</option>
          <option value="empty">⚠️ Belum Ada Silabus/AI</option>
          <option value="filled">✓ Silabus Lengkap</option>
        </select>

        {canEditRPS && filtered.length > 0 && (
          <button
            onClick={toggleSelectAll}
            className="macos-button-ghost text-xs px-2.5 py-1.5 flex items-center gap-1.5 text-gray-600 hover:text-gray-900 border border-gray-200"
          >
            <input
              type="checkbox"
              checked={selectedIds.size > 0 && selectedIds.size === filtered.length}
              onChange={() => {}}
              className="w-3.5 h-3.5 accent-emerald-600 pointer-events-none rounded"
            />
            {selectedIds.size === filtered.length ? 'Batal Pilih Semua' : 'Pilih Semua'}
          </button>
        )}
      </div>

      {/* Selected Items Floating/Action Bar */}
      {canEditRPS && selectedIds.size > 0 && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-apple-xl flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-emerald-900">
              ✓ {selectedIds.size} dari {filtered.length} RPS Dipilih
            </span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-emerald-700 hover:underline ml-2"
            >
              Reset Pilihan
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleGenerateSelectedAI}
              disabled={generatingSelectedAI}
              className="macos-button text-xs bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold px-3.5 py-1.5 rounded-apple-lg flex items-center gap-1.5 shadow-sm"
              title="Isi seluruh silabus & materi dengan AI untuk RPS terpilih"
            >
              {generatingSelectedAI ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {generatingSelectedAI ? 'AI Sedang Bekerja...' : `Generate AI (${selectedIds.size} RPS)`}
            </button>
            <button
              onClick={handlePublishSelected}
              disabled={generatingSelectedAI}
              className="macos-button text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-3.5 py-1.5 rounded-apple-lg flex items-center gap-1.5 shadow-sm"
            >
              <Send className="w-3.5 h-3.5" /> Publish {selectedIds.size} Terpilih
            </button>
            <button
              onClick={openSelectedCopy}
              disabled={generatingSelectedAI}
              className="macos-button text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3.5 py-1.5 rounded-apple-lg flex items-center gap-1.5 shadow-sm"
            >
              <Copy className="w-3.5 h-3.5" /> Salin {selectedIds.size} Terpilih ke Periode Baru
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Memuat...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Belum ada RPS</div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((rps) => {
            const StatusIcon = statusIcons[rps.status] || Clock
            const isSelected = selectedIds.has(rps.id)
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
              <div key={rps.id} className={`macos-card p-4 flex items-center gap-4 group transition-all ${isSelected ? 'ring-2 ring-emerald-500 bg-emerald-50/20' : ''}`}>
                {canEditRPS && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelectOne(rps.id)}
                    className="w-4 h-4 accent-emerald-600 rounded cursor-pointer shrink-0"
                  />
                )}
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
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[rps.status] || 'bg-gray-50 text-gray-600'}`}>
                    <StatusIcon className="w-3 h-3" />
                    {rps.status}
                  </span>
                  {isRpsEmpty(rps) ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80" title="Silabus / CPMK / Materi AI belum dibuat">
                      ⚠️ Belum Ada Materi
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80" title="Silabus & CPMK lengkap">
                      ✓ Materi Lengkap
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleExport(rps.id, 'pdf')} className="macos-button-ghost px-2.5 py-1.5 text-xs" title="Export PDF">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleExport(rps.id, 'docx')} className="macos-button-ghost px-2.5 py-1.5 text-xs" title="Export DOCX">
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                  {canEditRPS && (
                    <button onClick={() => openSingleCopyModal(rps)} className="macos-button-ghost px-2.5 py-1.5 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" title="Salin ke Periode Lain">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {canEditRPS && (
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
                  <label className="macos-label">Target Bulk AI *</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div
                      onClick={() => setBulkConfig({ ...bulkConfig, target_type: 'empty_rps' })}
                      className={`p-3 rounded-apple-xl border cursor-pointer transition-all ${
                        bulkConfig.target_type === 'empty_rps'
                          ? 'bg-purple-50/80 border-purple-500 ring-2 ring-purple-500/20 shadow-xs'
                          : 'bg-gray-50/60 border-gray-200 hover:bg-gray-100/60'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                        <span className="text-xs font-semibold text-gray-900">Lengkapi RPS Kosong</span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                        Isi silabus 16 pertemuan & CPMK untuk seluruh RPS berstatus <b>⚠️ Belum Ada Materi</b>.
                      </p>
                    </div>

                    <div
                      onClick={() => setBulkConfig({ ...bulkConfig, target_type: 'all_mk' })}
                      className={`p-3 rounded-apple-xl border cursor-pointer transition-all ${
                        bulkConfig.target_type === 'all_mk'
                          ? 'bg-purple-50/80 border-purple-500 ring-2 ring-purple-500/20 shadow-xs'
                          : 'bg-gray-50/60 border-gray-200 hover:bg-gray-100/60'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span className="text-xs font-semibold text-gray-900">Dari Master Mata Kuliah</span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                        Buat dokumen RPS baru dari daftar master mata kuliah yang belum punya RPS.
                      </p>
                    </div>
                  </div>
                </div>

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
                  <label className="macos-label">Target Tahun Akademik / Periode RPS *</label>
                  <div className="space-y-1.5">
                    <select
                      className="macos-input"
                      value={bulkConfig.tahun_akademik}
                      onChange={(e) => setBulkConfig({ ...bulkConfig, tahun_akademik: e.target.value })}
                    >
                      <option value="">-- Pilih dari Master Periode --</option>
                      {periodes.map((p) => (
                        <option key={p.id} value={p.nama}>
                          {p.nama} {p.is_active ? '(Aktif)' : ''}
                        </option>
                      ))}
                    </select>
                    <input
                      className="macos-input text-xs"
                      value={bulkConfig.tahun_akademik}
                      onChange={(e) => setBulkConfig({ ...bulkConfig, tahun_akademik: e.target.value })}
                      placeholder="Atau masukkan tahun akademik manual (misal: 2025/2026 Ganjil)"
                    />
                  </div>
                </div>

                <div className={`grid ${bulkConfig.target_type === 'all_mk' ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
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
                  </div>
                  {bulkConfig.target_type === 'all_mk' && (
                    <div>
                      <label className="macos-label">Filter Periode MK (Opsional)</label>
                      <select
                        className="macos-input"
                        value={bulkConfig.filter_mk_periode}
                        onChange={(e) => setBulkConfig({ ...bulkConfig, filter_mk_periode: e.target.value })}
                      >
                        <option value="all">Semua Periode MK</option>
                        {periodes.map((p) => (
                          <option key={p.id} value={p.nama}>
                            {p.nama}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
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
                  {bulkConfig.target_type === 'all_mk' && (
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={bulkConfig.skip_existing}
                        onChange={e => setBulkConfig({ ...bulkConfig, skip_existing: e.target.checked })}
                        className="w-4 h-4 accent-indigo-600 rounded"
                      />
                      <span className="text-xs font-medium text-gray-800">Lewati mata kuliah yang sudah ada RPS-nya</span>
                    </label>
                  )}

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

      {/* Modal Salin 1 RPS ke Periode Lain */}
      {showSingleCopyModal && copyTargetRps && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-apple-2xl shadow-apple-2xl w-full max-w-md p-6 space-y-4 border border-gray-100 animate-scale-up">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-apple-xl bg-emerald-50 text-emerald-600">
                <Copy className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Salin RPS ke Periode Lain</h3>
                <p className="text-xs text-gray-500 mt-0.5">Duplikasi silabus & capaian ke tahun akademik berikutnya</p>
              </div>
            </div>

            <div className="space-y-3.5 pt-2">
              <div className="p-3 bg-gray-50 rounded-apple-lg border border-gray-100 text-xs text-gray-600 space-y-1">
                <p><strong>Mata Kuliah:</strong> {copyTargetRps.identitas?.nama_mata_kuliah || copyTargetRps.kode}</p>
                <p><strong>Periode Saat Ini:</strong> {copyTargetRps.tahun_akademik || '-'}</p>
                <p><strong>Status Saat Ini:</strong> <span className="capitalize font-medium text-gray-800">{copyTargetRps.status}</span></p>
              </div>

              <div>
                <label className="macos-label">Target Tahun Akademik / Periode *</label>
                <div className="space-y-1.5">
                  <select
                    className="macos-input"
                    value={singleCopyPeriode}
                    onChange={(e) => setSingleCopyPeriode(e.target.value)}
                  >
                    <option value="">-- Pilih dari Master Periode --</option>
                    {periodes.map((p) => (
                      <option key={p.id} value={p.nama}>
                        {p.nama} {p.is_active ? '(Aktif)' : ''}
                      </option>
                    ))}
                  </select>
                  <input
                    className="macos-input text-xs"
                    value={singleCopyPeriode}
                    onChange={(e) => setSingleCopyPeriode(e.target.value)}
                    placeholder="Atau ketik manual (misal: 2025/2026 Ganjil)"
                  />
                </div>
              </div>

              <div>
                <label className="macos-label">Status Hasil Duplikasi</label>
                <select
                  className="macos-input"
                  value={singleCopyStatus}
                  onChange={(e) => setSingleCopyStatus(e.target.value)}
                >
                  <option value="draft">Draft (Rekomendasi - untuk ditinjau)</option>
                  <option value="review">Review</option>
                  <option value="approved">Approved</option>
                  <option value="published">Published</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button
                onClick={() => setShowSingleCopyModal(false)}
                disabled={singleCopying}
                className="macos-button-ghost text-xs px-3.5 py-2"
              >
                Batal
              </button>
              <button
                onClick={handleSingleCopySubmit}
                disabled={singleCopying || !singleCopyPeriode.trim()}
                className="macos-button flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-apple-lg"
              >
                {singleCopying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                {singleCopying ? 'Menyalin...' : 'Salin RPS'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Salin Massal RPS ke Periode Lain */}
      {showBulkCopyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-apple-2xl shadow-apple-2xl w-full max-w-lg p-6 space-y-5 border border-gray-100 max-h-[90vh] overflow-y-auto animate-scale-up">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-apple-xl bg-emerald-50 text-emerald-600">
                <Copy className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Salin Massal RPS ke Periode Baru</h3>
                <p className="text-xs text-gray-500 mt-0.5">Duplikasi seluruh RPS dari satu periode ke periode akademik berikutnya</p>
              </div>
            </div>

            {!bulkCopyResult ? (
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="macos-label">Periode Sumber (Asal) *</label>
                    <select
                      className="macos-input"
                      value={bulkCopyConfig.source_tahun_akademik}
                      onChange={(e) => setBulkCopyConfig({ ...bulkCopyConfig, source_tahun_akademik: e.target.value })}
                    >
                      <option value="">-- Pilih Periode Sumber --</option>
                      {allAvailablePeriodes.map((pName) => {
                        const pObj = periodes.find(p => p.nama === pName)
                        return (
                          <option key={pName} value={pName}>
                            {pName} {pObj?.is_active ? '(Aktif)' : ''}
                          </option>
                        )
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="macos-label">Periode Target (Tujuan) *</label>
                    <select
                      className="macos-input"
                      value={bulkCopyConfig.target_tahun_akademik}
                      onChange={(e) => setBulkCopyConfig({ ...bulkCopyConfig, target_tahun_akademik: e.target.value })}
                    >
                      <option value="">-- Pilih Periode Target --</option>
                      {allAvailablePeriodes.map((pName) => {
                        const pObj = periodes.find(p => p.nama === pName)
                        return (
                          <option key={pName} value={pName}>
                            {pName} {pObj?.is_active ? '(Aktif)' : ''}
                          </option>
                        )
                      })}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="macos-label">Program Studi</label>
                  <select
                    className="macos-input"
                    value={bulkCopyConfig.prodi_id}
                    onChange={(e) => setBulkCopyConfig({ ...bulkCopyConfig, prodi_id: e.target.value })}
                  >
                    <option value="all">Semua Program Studi</option>
                    {prodis.map((p) => (
                      <option key={p.id} value={p.id}>{p.nama} ({p.kode})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="macos-label">Status RPS yang Ingin Disalin</label>
                  <div className="grid grid-cols-2 gap-2 mt-1 p-3 bg-gray-50 rounded-apple-lg border border-gray-100">
                    {['draft', 'review', 'approved', 'published'].map((st) => (
                      <label key={st} className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700 capitalize">
                        <input
                          type="checkbox"
                          checked={bulkCopyConfig.statuses.includes(st)}
                          onChange={(e) => {
                            const cur = bulkCopyConfig.statuses
                            if (e.target.checked) {
                              setBulkCopyConfig({ ...bulkCopyConfig, statuses: [...cur, st] })
                            } else {
                              setBulkCopyConfig({ ...bulkCopyConfig, statuses: cur.filter(x => x !== st) })
                            }
                          }}
                          className="w-3.5 h-3.5 accent-emerald-600 rounded"
                        />
                        {st}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="macos-label">Status Hasil di Periode Target</label>
                    <select
                      className="macos-input"
                      value={bulkCopyConfig.target_status}
                      onChange={(e) => setBulkCopyConfig({ ...bulkCopyConfig, target_status: e.target.value })}
                    >
                      <option value="draft">Draft (Ditinjau Dosen)</option>
                      <option value="review">Review</option>
                      <option value="approved">Approved</option>
                      <option value="published">Published</option>
                    </select>
                  </div>
                  <div className="flex items-center pt-5">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-800">
                      <input
                        type="checkbox"
                        checked={bulkCopyConfig.skip_existing}
                        onChange={(e) => setBulkCopyConfig({ ...bulkCopyConfig, skip_existing: e.target.checked })}
                        className="w-4 h-4 accent-emerald-600 rounded"
                      />
                      Lewati jika sudah ada di periode target
                    </label>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 bg-emerald-50 rounded-apple-xl border border-emerald-100">
                    <p className="text-2xl font-bold text-emerald-600">{bulkCopyResult.copied}</p>
                    <p className="text-xs font-medium text-emerald-700 mt-0.5">Berhasil Disalin</p>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-apple-xl border border-amber-100">
                    <p className="text-2xl font-bold text-amber-600">{bulkCopyResult.skipped}</p>
                    <p className="text-xs font-medium text-amber-700 mt-0.5">Dilewati (Sudah Ada)</p>
                  </div>
                  <div className="p-3 bg-rose-50 rounded-apple-xl border border-rose-100">
                    <p className="text-2xl font-bold text-rose-600">{bulkCopyResult.errors}</p>
                    <p className="text-xs font-medium text-rose-700 mt-0.5">Gagal</p>
                  </div>
                </div>

                {bulkCopyResult.detail?.length > 0 && (
                  <div className="max-h-48 overflow-y-auto p-3 bg-gray-50 rounded-apple-lg border border-gray-100 text-xs space-y-1">
                    <p className="font-semibold text-gray-700 mb-1">Daftar RPS Berhasil Disalin:</p>
                    {bulkCopyResult.detail.map((d: any, i: number) => (
                      <p key={i} className="text-gray-600 flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="font-medium text-gray-800">{d.nama}</span> ({d.target_kode})
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
              {!bulkCopyResult ? (
                <>
                  <button
                    onClick={() => setShowBulkCopyModal(false)}
                    disabled={bulkCopying}
                    className="macos-button-ghost text-xs px-3.5 py-2"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleBulkCopySubmit}
                    disabled={bulkCopying || !bulkCopyConfig.source_tahun_akademik || !bulkCopyConfig.target_tahun_akademik || bulkCopyConfig.statuses.length === 0}
                    className="macos-button flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-apple-lg disabled:opacity-50"
                  >
                    {bulkCopying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                    {bulkCopying ? 'Menyalin Semua RPS...' : 'Mulai Salin Massal'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowBulkCopyModal(false)}
                  className="macos-button text-xs bg-gray-900 hover:bg-black text-white font-medium px-4 py-2 rounded-apple-lg"
                >
                  Selesai
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Salin RPS Terpilih (Multi-Select Checkboxes) */}
      {showSelectedCopyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-apple-2xl shadow-apple-2xl w-full max-w-md p-6 space-y-4 border border-gray-100 animate-scale-up">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-apple-xl bg-emerald-50 text-emerald-600">
                <Copy className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Salin {selectedIds.size} RPS Terpilih</h3>
                <p className="text-xs text-gray-500 mt-0.5">Duplikasi RPS yang dicentang ke periode akademik baru</p>
              </div>
            </div>

            <div className="space-y-3.5 pt-1">
              <div>
                <label className="macos-label">Periode Akademik Tujuan *</label>
                <div className="space-y-2 mt-1">
                  <select
                    className="macos-input"
                    value={selectedCopyPeriode}
                    onChange={(e) => setSelectedCopyPeriode(e.target.value)}
                  >
                    <option value="">-- Pilih Periode Tujuan --</option>
                    {periodes.map((p) => (
                      <option key={p.id} value={p.nama}>
                        {p.nama} {p.is_active ? '(Aktif)' : ''}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Atau ketik periode manual (cth: 2025/2026 Ganjil)"
                    value={selectedCopyPeriode}
                    onChange={(e) => setSelectedCopyPeriode(e.target.value)}
                    className="macos-input text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="macos-label">Status Hasil di Periode Baru</label>
                <select
                  className="macos-input"
                  value={selectedCopyStatus}
                  onChange={(e) => setSelectedCopyStatus(e.target.value)}
                >
                  <option value="draft">Draft (Rekomendasi - untuk ditinjau dosen)</option>
                  <option value="review">Review</option>
                  <option value="approved">Approved</option>
                  <option value="published">Published</option>
                </select>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-800">
                  <input
                    type="checkbox"
                    checked={selectedCopySkip}
                    onChange={(e) => setSelectedCopySkip(e.target.checked)}
                    className="w-4 h-4 accent-emerald-600 rounded"
                  />
                  Lewati jika RPS mata kuliah sudah ada di periode target
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button
                onClick={() => setShowSelectedCopyModal(false)}
                disabled={selectedCopying}
                className="macos-button-ghost text-xs px-3.5 py-2"
              >
                Batal
              </button>
              <button
                onClick={handleSelectedCopySubmit}
                disabled={selectedCopying || !selectedCopyPeriode.trim()}
                className="macos-button flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-apple-lg"
              >
                {selectedCopying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                {selectedCopying ? 'Menyalin...' : `Salin ${selectedIds.size} RPS`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Sinkronisasi Jadwal Kuliah & Dosen Pengampu */}
      {showJadwalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-apple-2xl shadow-apple-2xl w-full max-w-3xl h-[88vh] max-h-[720px] flex flex-col border border-gray-100 overflow-hidden animate-scale-up">
            {/* 1. Header (Fixed) */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-apple-xl bg-blue-50 text-blue-600">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-gray-900">Sinkronisasi Jadwal & Dosen Pengampu</h3>
                  <p className="text-[11px] text-gray-500">Ekstrak dosen pengampu dari file Excel SIAKAD dan pasangkan ke RPS periode target</p>
                </div>
              </div>
              <button
                onClick={() => setShowJadwalModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-apple-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 2. Scrollable Body */}
            <div className="p-4 space-y-3.5 flex-1 overflow-y-auto min-h-0">
              {/* Konfigurasi Target Periode & Prodi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-blue-50/50 rounded-apple-xl border border-blue-100/60">
                <div>
                  <label className="text-[11px] font-semibold text-blue-900 block mb-1">Periode Akademik Tujuan *</label>
                  <select
                    className="macos-input bg-white text-xs py-1.5"
                    value={jadwalTargetPeriode}
                    onChange={(e) => setJadwalTargetPeriode(e.target.value)}
                  >
                    <option value="">-- Pilih Periode Tujuan --</option>
                    {allAvailablePeriodes.map((pName) => {
                      const pObj = periodes.find(p => p.nama === pName)
                      return (
                        <option key={pName} value={pName}>
                          {pName} {pObj?.is_active ? '(Aktif)' : ''}
                        </option>
                      )
                    })}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-blue-900 block mb-1">Filter Program Studi</label>
                  <select
                    className="macos-input bg-white text-xs py-1.5"
                    value={jadwalProdiId}
                    onChange={(e) => setJadwalProdiId(e.target.value)}
                  >
                    <option value="all">Semua Program Studi</option>
                    {prodis.map((p) => (
                      <option key={p.id} value={p.id}>{p.nama} ({p.kode})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Konfigurasi Status Hasil & Update Semester */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-gray-50 rounded-apple-xl border border-gray-200/80">
                <div>
                  <label className="text-[11px] font-semibold text-gray-800 block mb-1">Status RPS Hasil Sinkronisasi</label>
                  <select
                    className="macos-input bg-white text-xs py-1.5"
                    value={jadwalTargetStatus}
                    onChange={(e: any) => setJadwalTargetStatus(e.target.value)}
                  >
                    <option value="published">Published (Langsung Publikasi jika memiliki dosen)</option>
                    <option value="draft">Draft (Disimpan sebagai draf)</option>
                  </select>
                </div>

                <div className="flex flex-col justify-center space-y-1 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-800">
                    <input
                      type="checkbox"
                      checked={jadwalAutoUpdateSemester}
                      onChange={(e) => setJadwalAutoUpdateSemester(e.target.checked)}
                      className="w-4 h-4 accent-blue-600 rounded cursor-pointer shrink-0"
                    />
                    <span>Perbarui <strong className="text-gray-950">Semester MK & RPS</strong> dari Excel</span>
                  </label>
                  <p className="text-[10px] text-gray-500 ml-6">Otomatis memperbaiki data MK yang sebelumnya salah semester (misal default 1)</p>
                </div>
              </div>

              {/* Checkbox Auto-Create MK & Draft RPS */}
              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-blue-950 bg-blue-100/60 hover:bg-blue-100/90 p-2.5 rounded-apple-xl border border-blue-200/70 transition-all">
                <input
                  type="checkbox"
                  checked={jadwalAutoCreate}
                  onChange={(e) => setJadwalAutoCreate(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer shrink-0"
                />
                <span>
                  <strong className="text-blue-900">Otomatis Daftarkan MK & Buat RPS</strong> jika belum ada di database (menyalin CPL/silabus lama jika ada)
                </span>
              </label>

              {/* Input Metode Upload / Paste */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setJadwalInputMode('upload')}
                      className={`text-xs font-medium px-2.5 py-1.5 rounded-apple-lg transition-all ${
                        jadwalInputMode === 'upload'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <FileUp className="w-3.5 h-3.5 inline mr-1" /> Upload Excel (.xlsx / .csv)
                    </button>
                    <button
                      onClick={() => setJadwalInputMode('paste')}
                      className={`text-xs font-medium px-2.5 py-1.5 rounded-apple-lg transition-all ${
                        jadwalInputMode === 'paste'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5 inline mr-1" /> Copy-Paste
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => downloadJadwalTemplate('simple')}
                      className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-apple-md transition-colors"
                      title="Unduh template standar (Kode MK, Nama MK, Prodi, Dosen)"
                    >
                      <Download className="w-3 h-3" /> Template Standar
                    </button>
                    <button
                      onClick={() => downloadJadwalTemplate('siakad')}
                      className="text-[11px] text-emerald-600 hover:text-emerald-800 flex items-center gap-1 font-medium bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-apple-md transition-colors"
                      title="Unduh template format SIAKAD (16 kolom)"
                    >
                      <Download className="w-3 h-3" /> Template SIAKAD
                    </button>
                  </div>
                </div>

                {jadwalInputMode === 'upload' ? (
                  <div className="p-3 border-2 border-dashed border-gray-200 rounded-apple-xl bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-2.5 hover:border-blue-300 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileSpreadsheet className="w-6 h-6 text-blue-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-700">Pilih file jadwal kuliah SIAKAD</p>
                        <input
                          type="file"
                          accept=".xlsx,.xlsm,.xls,.csv,.txt"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setJadwalFile(e.target.files[0])
                              setJadwalExtracted([])
                            }
                          }}
                          className="text-xs mt-1 text-gray-600 file:mr-2 file:py-0.5 file:px-2.5 file:rounded-apple-md file:border-0 file:text-[11px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleParseJadwal}
                      disabled={jadwalParsing || !jadwalFile}
                      className="macos-button flex items-center gap-1.5 text-xs bg-gray-900 hover:bg-black text-white font-medium px-3.5 py-1.5 rounded-apple-lg disabled:opacity-50 shrink-0"
                    >
                      {jadwalParsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      {jadwalParsing ? 'Mengekstrak...' : 'Ekstrak Dosen'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      rows={3}
                      placeholder="Paste tabel data dari Excel di sini..."
                      value={jadwalRawText}
                      onChange={(e) => {
                        setJadwalRawText(e.target.value)
                        setJadwalExtracted([])
                      }}
                      className="macos-input text-xs font-mono w-full"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={handleParseJadwal}
                        disabled={jadwalParsing || !jadwalRawText.trim()}
                        className="macos-button flex items-center gap-1.5 text-xs bg-gray-900 hover:bg-black text-white font-medium px-3.5 py-1.5 rounded-apple-lg disabled:opacity-50"
                      >
                        {jadwalParsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        {jadwalParsing ? 'Mengekstrak...' : 'Ekstrak Dosen'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Hasil Ekstraksi & Preview Table */}
              {jadwalExtracted.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      {jadwalExtracted.length} Mata Kuliah Terdeteksi
                    </span>
                    <div className="relative w-48">
                      <Search className="w-3 h-3 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Cari MK/Dosen..."
                        value={jadwalSearch}
                        onChange={(e) => setJadwalSearch(e.target.value)}
                        className="macos-input pl-7 py-0.5 text-[11px]"
                      />
                    </div>
                  </div>

                  <div className="max-h-44 overflow-y-auto border border-gray-200 rounded-apple-xl bg-white shadow-xs">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead className="bg-gray-50 text-gray-600 sticky top-0 border-b border-gray-200">
                        <tr>
                          <th className="p-2 font-semibold">Kode</th>
                          <th className="p-2 font-semibold">Nama Mata Kuliah</th>
                          <th className="p-2 font-semibold">Prodi</th>
                          <th className="p-2 font-semibold text-center">Sem</th>
                          <th className="p-2 font-semibold">Dosen Pengampu & Tim</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {jadwalExtracted
                          .filter((item) => {
                            if (!jadwalSearch) return true
                            const s = jadwalSearch.toLowerCase()
                            const k = item.kode_mk?.toLowerCase() || ''
                            const n = item.nama_mk?.toLowerCase() || ''
                            const p = item.prodi_nama?.toLowerCase() || ''
                            const d = (item.semua_dosen || []).join(' ').toLowerCase()
                            return k.includes(s) || n.includes(s) || p.includes(s) || d.includes(s)
                          })
                          .map((item, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/70">
                              <td className="p-2 font-mono font-medium text-gray-800">{item.kode_mk}</td>
                              <td className="p-2 font-medium text-gray-900">{item.nama_mk}</td>
                              <td className="p-2 text-gray-600">{item.prodi_nama || item.kurikulum || '-'}</td>
                              <td className="p-2 text-gray-600 text-center">{item.semester}</td>
                              <td className="p-2 text-gray-800">
                                {item.semua_dosen && item.semua_dosen.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {item.semua_dosen.map((d: string, dIdx: number) => (
                                      <span
                                        key={dIdx}
                                        className="px-1.5 py-0.5 rounded-apple bg-blue-50 text-blue-700 font-medium text-[10px] border border-blue-100"
                                      >
                                        {d}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-gray-400 italic">Tidak ada dosen</span>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Hasil Eksekusi Sinkronisasi */}
              {jadwalSyncResult && (
                <div className="space-y-2.5 pt-2 border-t border-gray-100 animate-fade-in">
                  <div className="grid grid-cols-3 gap-2.5 text-center">
                    <div className="p-2.5 bg-emerald-50 rounded-apple-xl border border-emerald-100">
                      <p className="text-xl font-bold text-emerald-600">{jadwalSyncResult.updated_rps}</p>
                      <p className="text-[11px] font-medium text-emerald-700">RPS Berhasil Disinkron</p>
                    </div>
                    <div className="p-2.5 bg-amber-50 rounded-apple-xl border border-amber-100">
                      <p className="text-xl font-bold text-amber-600">{jadwalSyncResult.not_found_rps}</p>
                      <p className="text-[11px] font-medium text-amber-700">RPS Belum Dibuat</p>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-apple-xl border border-gray-100">
                      <p className="text-xl font-bold text-gray-600">{jadwalSyncResult.skipped}</p>
                      <p className="text-[11px] font-medium text-gray-700">Dilewati</p>
                    </div>
                  </div>

                  {jadwalSyncResult.detail?.length > 0 && (
                    <div className="max-h-32 overflow-y-auto p-2 bg-gray-50 rounded-apple-lg border border-gray-100 text-[11px] space-y-1">
                      {jadwalSyncResult.detail.slice(0, 50).map((d: any, i: number) => (
                        <div key={i} className="flex items-center gap-1.5 text-gray-700">
                          {d.status === 'updated' ? (
                            <CheckCircle className="w-3 h-3 text-emerald-600 shrink-0" />
                          ) : (
                            <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
                          )}
                          <span className="font-mono font-medium">{d.kode}</span> - {d.nama}: <span className="text-gray-500">{d.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3. Footer Bar (Always Fixed at Bottom) */}
            <div className="p-3.5 px-5 bg-gray-50 border-t border-gray-200 shrink-0 flex items-center justify-between z-10">
              <div>
                {jadwalExtracted.length > 0 && !jadwalSyncResult && (
                  <span className="text-xs font-semibold text-gray-700">
                    🎯 Target Periode: <span className="text-blue-700 font-bold">{jadwalTargetPeriode}</span> ({jadwalExtracted.length} MK)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowJadwalModal(false)}
                  disabled={jadwalSyncing}
                  className="macos-button-ghost text-xs px-3.5 py-2"
                >
                  {jadwalSyncResult ? 'Selesai' : 'Batal'}
                </button>
                {jadwalExtracted.length > 0 && !jadwalSyncResult && (
                  <button
                    onClick={handleSyncJadwalSubmit}
                    disabled={jadwalSyncing || !jadwalTargetPeriode.trim()}
                    className="macos-button flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-apple-lg shadow-md hover:shadow-lg transition-all"
                  >
                    {jadwalSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
                    {jadwalSyncing ? 'Menyinkronkan ke RPS...' : `Terapkan Sinkronisasi Sekarang`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Publish Massal RPS Berdosen */}
      {showBulkPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-apple-2xl shadow-apple-2xl w-full max-w-lg flex flex-col border border-gray-100 overflow-hidden animate-scale-up">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-apple-xl bg-indigo-50 text-indigo-600">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-gray-900">Publish Massal RPS</h3>
                  <p className="text-[11px] text-gray-500">Ubah status RPS Draft menjadi Published secara massal</p>
                </div>
              </div>
              <button
                onClick={() => setShowBulkPublishModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-apple-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Periode Akademik Target</label>
                <select
                  className="macos-input bg-white text-xs w-full"
                  value={bulkPublishPeriode}
                  onChange={(e) => setBulkPublishPeriode(e.target.value)}
                >
                  <option value="all">Semua Periode</option>
                  {allAvailablePeriodes.map((pName) => {
                    const pObj = periodes.find(p => p.nama === pName)
                    return (
                      <option key={pName} value={pName}>
                        {pName} {pObj?.is_active ? '(Aktif)' : ''}
                      </option>
                    )
                  })}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Program Studi</label>
                <select
                  className="macos-input bg-white text-xs w-full"
                  value={bulkPublishProdiId}
                  onChange={(e) => setBulkPublishProdiId(e.target.value)}
                >
                  <option value="all">Semua Program Studi</option>
                  {prodis.map((p) => (
                    <option key={p.id} value={p.id}>{p.nama} ({p.kode})</option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-indigo-950 bg-indigo-50/80 hover:bg-indigo-50 p-3 rounded-apple-xl border border-indigo-100 transition-all">
                <input
                  type="checkbox"
                  checked={bulkPublishOnlyWithDosen}
                  onChange={(e) => setBulkPublishOnlyWithDosen(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer shrink-0"
                />
                <span>
                  Hanya publikasikan RPS yang <strong className="text-indigo-900">sudah memiliki Dosen Pengampu</strong>
                </span>
              </label>

              <div className="p-3 bg-amber-50 rounded-apple-xl border border-amber-200/70 text-[11px] text-amber-800 space-y-1">
                <p className="font-semibold flex items-center gap-1 text-amber-900">
                  <AlertCircle className="w-3.5 h-3.5" /> Informasi Publikasi
                </p>
                <p>
                  Semua RPS draft yang cocok dengan kriteria di atas akan langsung berstatus <strong>Published</strong> (tayang di sistem) sehingga dapat dilihat dan digunakan oleh dosen & mahasiswa.
                </p>
              </div>
            </div>

            <div className="p-3.5 px-5 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowBulkPublishModal(false)}
                disabled={bulkPublishing}
                className="macos-button-ghost text-xs px-3.5 py-2"
              >
                Batal
              </button>
              <button
                onClick={handleBulkPublishSubmit}
                disabled={bulkPublishing}
                className="macos-button flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2 rounded-apple-lg shadow-sm"
              >
                {bulkPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {bulkPublishing ? 'Mempublikasikan...' : 'Publikasikan Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}