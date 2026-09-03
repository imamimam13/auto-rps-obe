import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Server, Cpu, RefreshCw, Link, Key, Calendar, Plus, Trash2, Edit2, Check, CheckCircle2, X } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'

interface Periode {
  id: number
  kode: string
  nama: string
  tahun_akademik: string
  semester_tipe: string
  is_active: boolean
  status: string
}

const providers = [
  { value: 'ollama', label: 'Ollama (Local)' },
  { value: 'lmstudio', label: 'LM Studio' },
  { value: '9router', label: '9Router' },
  { value: 'openai', label: 'OpenAI Compatible' },
]

export default function Settings() {
  const [aiStatus, setAiStatus] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [provider, setProvider] = useState('ollama')
  const [aiUrl, setAiUrl] = useState('http://localhost:11434')
  const [model, setModel] = useState('llama3.1:8b')
  const [apiKey, setApiKey] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [campusName, setCampusName] = useState('')
  const [campusLogoUrl, setCampusLogoUrl] = useState('')
  const [koordinatorPengembang, setKoordinatorPengembang] = useState('')
  const [koordinatorRmk, setKoordinatorRmk] = useState('')
  const [kaProdi, setKaProdi] = useState('')
  const [rentangPenilaian, setRentangPenilaian] = useState('')
  const [savingBranding, setSavingBranding] = useState(false)

  // Periode state
  const [periodes, setPeriodes] = useState<Periode[]>([])
  const [loadingPeriodes, setLoadingPeriodes] = useState(false)
  const [showAddPeriodeModal, setShowAddPeriodeModal] = useState(false)
  const [editingPeriode, setEditingPeriode] = useState<Periode | null>(null)
  const [savingPeriode, setSavingPeriode] = useState(false)
  const [periodeForm, setPeriodeForm] = useState({
    kode: '',
    nama: '',
    tahun_akademik: '2025/2026',
    semester_tipe: 'ganjil',
    is_active: false,
    status: 'aktif',
  })

  useEffect(() => { 
    checkAI()
    loadBranding()
    loadPeriodes()
  }, [])

  async function loadPeriodes() {
    setLoadingPeriodes(true)
    try {
      const res = await api.get('/api/v1/periode/')
      setPeriodes(res.data.items || [])
    } catch {
      toast.error('Gagal memuat daftar periode')
    } finally {
      setLoadingPeriodes(false)
    }
  }

  function openAddPeriodeModal() {
    const currentYear = new Date().getFullYear()
    const defaultTahun = `${currentYear}/${currentYear + 1}`
    const defaultKode = `${currentYear}-1`
    const defaultNama = `${defaultTahun} Ganjil`
    setPeriodeForm({
      kode: defaultKode,
      nama: defaultNama,
      tahun_akademik: defaultTahun,
      semester_tipe: 'ganjil',
      is_active: false,
      status: 'aktif',
    })
    setShowAddPeriodeModal(true)
  }

  function handleTahunOrSemesterChange(tahun: string, tipe: string) {
    const startYear = tahun.split('/')[0] || tahun.substring(0, 4)
    const suffix = tipe === 'ganjil' ? '1' : tipe === 'genap' ? '2' : '3'
    const tipeLabel = tipe.charAt(0).toUpperCase() + tipe.slice(1)
    const newKode = startYear ? `${startYear}-${suffix}` : ''
    const newNama = tahun ? `${tahun} ${tipeLabel}` : ''
    
    setPeriodeForm(prev => ({
      ...prev,
      tahun_akademik: tahun,
      semester_tipe: tipe,
      kode: newKode || prev.kode,
      nama: newNama || prev.nama,
    }))
  }

  async function handleCreatePeriode() {
    if (!periodeForm.kode.trim() || !periodeForm.nama.trim() || !periodeForm.tahun_akademik.trim()) {
      toast.error('Kode, Nama, dan Tahun Akademik wajib diisi')
      return
    }
    setSavingPeriode(true)
    try {
      await api.post('/api/v1/periode/', periodeForm)
      toast.success('Periode akademik berhasil ditambahkan!')
      setShowAddPeriodeModal(false)
      loadPeriodes()
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Gagal menambahkan periode')
    } finally {
      setSavingPeriode(false)
    }
  }

  function openEditPeriodeModal(p: Periode) {
    setEditingPeriode(p)
  }

  async function handleUpdatePeriode() {
    if (!editingPeriode) return
    setSavingPeriode(true)
    try {
      await api.put(`/api/v1/periode/${editingPeriode.id}`, {
        kode: editingPeriode.kode,
        nama: editingPeriode.nama,
        tahun_akademik: editingPeriode.tahun_akademik,
        semester_tipe: editingPeriode.semester_tipe,
        status: editingPeriode.status,
        is_active: editingPeriode.is_active,
      })
      toast.success('Periode akademik berhasil diperbarui!')
      setEditingPeriode(null)
      loadPeriodes()
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Gagal memperbarui periode')
    } finally {
      setSavingPeriode(false)
    }
  }

  async function handleSetActivePeriode(p: Periode) {
    if (p.is_active) return
    try {
      await api.put(`/api/v1/periode/${p.id}/set-active`)
      toast.success(`Periode '${p.nama}' sekarang aktif!`)
      loadPeriodes()
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Gagal mengaktifkan periode')
    }
  }

  async function handleDeletePeriode(p: Periode) {
    if (!confirm(`Apakah Anda yakin ingin menghapus periode '${p.nama}'?`)) return
    try {
      await api.delete(`/api/v1/periode/${p.id}`)
      toast.success('Periode berhasil dihapus')
      loadPeriodes()
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Gagal menghapus periode')
    }
  }

  async function loadBranding() {
    try {
      const res = await api.get('/api/v1/ollama/branding')
      setCampusName(res.data.brand_campus_name || '')
      setCampusLogoUrl(res.data.brand_campus_logo_url || '')
      setKoordinatorPengembang(res.data.default_koordinator_pengembang || '')
      setKoordinatorRmk(res.data.default_koordinator_rmk || '')
      setKaProdi(res.data.default_ka_prodi || '')
      setRentangPenilaian(res.data.brand_rentang_penilaian || '')
    } catch {
      // ignored
    }
  }

  async function checkAI() {
    try {
      const res = await api.get('/api/v1/ollama/status')
      setAiStatus(res.data.available)
      if (res.data.provider) setProvider(res.data.provider)
      if (res.data.base_url) setAiUrl(res.data.base_url)
      if (res.data.model) setModel(res.data.model)
      if (res.data.api_key) setApiKey(res.data.api_key)
      if (res.data.available) {
        const mRes = await api.get('/api/v1/ollama/models')
        setModels(mRes.data.models || [])
      }
    } catch {
      setAiStatus(false)
    }
  }

  async function connectAI() {
    setConnecting(true)
    try {
      const res = await api.post('/api/v1/ollama/configure', {
        provider,
        base_url: aiUrl,
        model,
        api_key: apiKey,
      })
      setAiStatus(res.data.available)
      if (res.data.available) {
        const mRes = await api.get('/api/v1/ollama/models')
        setModels(mRes.data.models || [])
        toast.success('Terhubung ke AI!')
      } else {
        toast.error('AI tidak merespon')
      }
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Gagal terhubung')
    } finally {
      setConnecting(false)
    }
  }

  async function handleSaveBranding() {
    setSavingBranding(true)
    try {
      await api.post('/api/v1/ollama/branding', {
        brand_campus_name: campusName,
        brand_campus_logo_url: campusLogoUrl,
        default_koordinator_pengembang: koordinatorPengembang,
        default_koordinator_rmk: koordinatorRmk,
        default_ka_prodi: kaProdi,
        brand_rentang_penilaian: rentangPenilaian,
      })
      toast.success('Identitas branding disimpan!')
    } catch {
      toast.error('Gagal menyimpan branding')
    } finally {
      setSavingBranding(false)
    }
  }

  function handleProviderChange(p: string) {
    setProvider(p)
    const defaults: Record<string, string> = {
      ollama: 'http://localhost:11434',
      lmstudio: 'http://localhost:1234',
      '9router': 'https://9router.ai/v1',
      openai: 'https://api.openai.com/v1',
    }
    setAiUrl(defaults[p] || '')
  }

  async function handleModelChange(newModel: string) {
    setModel(newModel)
    try {
      await api.post('/api/v1/ollama/configure', { provider, base_url: aiUrl, model: newModel, api_key: apiKey })
      toast.success(`Model: ${newModel}`)
    } catch { toast.error('Gagal ganti model') }
  }

  const needsApiKey = provider !== 'ollama'

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Pengaturan</h1>
        <p className="text-sm text-gray-500 mt-1">Konfigurasi aplikasi</p>
      </div>

      <div className="macos-card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className={`p-2.5 rounded-apple-lg ${aiStatus ? 'bg-green-50' : 'bg-red-50'}`}>
            <Cpu className={`w-5 h-5 ${aiStatus ? 'text-green-500' : 'text-red-500'}`} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900">AI Engine</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Status: {aiStatus ? (
                <span className="text-green-600 font-medium">Online</span>
              ) : (
                <span className="text-red-500 font-medium">Offline</span>
              )}
            </p>
          </div>
          <button onClick={checkAI} className="macos-button-ghost p-2" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="macos-label">Provider</label>
            <select className="macos-input" value={provider} onChange={(e) => handleProviderChange(e.target.value)}>
              {providers.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="macos-label">Base URL</label>
            <input className="macos-input" value={aiUrl} onChange={(e) => setAiUrl(e.target.value)} placeholder="http://localhost:11434" />
          </div>
          {needsApiKey && (
            <div>
              <label className="macos-label flex items-center gap-1.5"><Key className="w-3.5 h-3.5" /> API Key</label>
              <input type="password" className="macos-input" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." />
            </div>
          )}
          <div>
            <label className="macos-label">Model</label>
            <select className="macos-input" value={model} onChange={(e) => handleModelChange(e.target.value)}>
              {models.length > 0 ? (
                models.map(m => <option key={m} value={m}>{m}</option>)
              ) : (
                <option value={model}>{model}</option>
              )}
            </select>
            {models.length > 0 && <p className="text-[11px] text-gray-400 mt-1">{models.length} model tersedia</p>}
          </div>
          <button onClick={connectAI} disabled={connecting} className="macos-button w-full py-2 flex items-center justify-center gap-2">
            <Link className="w-4 h-4" />
            {connecting ? 'Menghubungkan...' : 'Hubungkan & Simpan'}
          </button>
        </div>
      </div>

      <div className="macos-card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-apple-lg bg-orange-50">
            <SettingsIcon className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Identitas & Branding Kampus</h3>
            <p className="text-xs text-gray-500 mt-0.5">Ubah nama kampus dan logo yang muncul pada dokumen ekspor RPS.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="macos-label">Nama Perguruan Tinggi / Sekolah Tinggi</label>
            <input 
              className="macos-input" 
              value={campusName} 
              onChange={(e) => setCampusName(e.target.value)} 
              placeholder="SEKOLAH TINGGI ILMU EKONOMI WIRA BHAKTI MAKASSAR" 
            />
          </div>
          <div>
            <label className="macos-label">URL Logo Kampus (Opsional)</label>
            <input 
              className="macos-input" 
              value={campusLogoUrl} 
              onChange={(e) => setCampusLogoUrl(e.target.value)} 
              placeholder="https://example.com/logo.png" 
            />
            <p className="text-[10px] text-gray-400 mt-1">Kosongkan jika ingin menggunakan logo default. URL gambar harus diawali dengan https://.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="macos-label">Koordinator Rumpun MK (RMK)</label>
              <input 
                className="macos-input" 
                value={koordinatorRmk} 
                onChange={(e) => setKoordinatorRmk(e.target.value)} 
                placeholder="Nama Koordinator RMK" 
              />
            </div>
            <div>
              <label className="macos-label">Ketua Program Studi (Ka Prodi)</label>
              <input 
                className="macos-input" 
                value={kaProdi} 
                onChange={(e) => setKaProdi(e.target.value)} 
                placeholder="Nama Ka Prodi" 
              />
            </div>
          </div>
          <div>
            <label className="macos-label">Rentang Penilaian (Grading Scale)</label>
            <textarea 
              className="macos-input h-24 py-2 font-mono text-[11px]" 
              value={rentangPenilaian} 
              onChange={(e) => setRentangPenilaian(e.target.value)} 
              placeholder="A: 85 - 100&#10;B+: 80 - 84&#10;B: 75 - 79&#10;C+: 70 - 74&#10;C: 60 - 69&#10;D: 50 - 59&#10;E: < 50" 
            />
            <p className="text-[10px] text-gray-400 mt-1">Masukkan rentang nilai per baris yang akan dicetak pada bagian Evaluasi & Penilaian RPS.</p>
          </div>
          <button onClick={handleSaveBranding} disabled={savingBranding} className="macos-button w-full py-2 flex items-center justify-center gap-2">
            {savingBranding ? 'Menyimpan...' : 'Simpan Identitas'}
          </button>
        </div>
      </div>

      {/* Manajemen Periode Akademik */}
      <div className="macos-card p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-apple-lg bg-indigo-50">
              <Calendar className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Periode Akademik</h3>
              <p className="text-xs text-gray-500 mt-0.5">Kelola master periode semester & tahun akademik untuk RPS & Mata Kuliah.</p>
            </div>
          </div>
          <button
            onClick={openAddPeriodeModal}
            className="macos-button flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-apple-md font-medium"
          >
            <Plus className="w-4 h-4" /> Tambah Periode
          </button>
        </div>

        {loadingPeriodes ? (
          <div className="text-center py-6 text-gray-400 text-xs">Memuat periode...</div>
        ) : periodes.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-xs">Belum ada periode. Klik "Tambah Periode" untuk membuat.</div>
        ) : (
          <div className="space-y-2.5">
            {periodes.map((p) => (
              <div
                key={p.id}
                className={`p-3.5 rounded-apple-lg border transition-all flex items-center justify-between gap-4 ${
                  p.is_active
                    ? 'bg-indigo-50/50 border-indigo-200 shadow-xs'
                    : 'bg-white border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      p.is_active ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-gray-900">{p.nama}</span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                        {p.kode}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full ${
                          p.semester_tipe === 'ganjil'
                            ? 'bg-amber-50 text-amber-700'
                            : p.semester_tipe === 'genap'
                            ? 'bg-teal-50 text-teal-700'
                            : 'bg-purple-50 text-purple-700'
                        }`}
                      >
                        {p.semester_tipe}
                      </span>
                      {p.is_active && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white shadow-xs">
                          <CheckCircle2 className="w-3 h-3" /> Periode Aktif
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Tahun Akademik: <span className="font-medium text-gray-700">{p.tahun_akademik}</span> · Status:{' '}
                      <span className="capitalize">{p.status || 'aktif'}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!p.is_active && (
                    <button
                      onClick={() => handleSetActivePeriode(p)}
                      className="macos-button-ghost text-xs text-indigo-600 hover:bg-indigo-50 px-2.5 py-1 rounded-apple font-medium"
                    >
                      Jadikan Aktif
                    </button>
                  )}
                  <button
                    onClick={() => openEditPeriodeModal(p)}
                    className="macos-button-ghost p-1.5 text-gray-500 hover:text-gray-900"
                    title="Edit Periode"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeletePeriode(p)}
                    className="macos-button-ghost p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50"
                    title="Hapus Periode"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="macos-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-apple-lg bg-blue-50">
            <Server className="w-5 h-5 text-blue-500" />
          </div>
          <div><h3 className="text-sm font-semibold text-gray-900">Informasi Aplikasi</h3></div>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-1.5 border-b border-gray-100">
            <span className="text-gray-500">Versi</span><span className="text-gray-900">1.0.0</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-gray-100">
            <span className="text-gray-500">Framework</span><span className="text-gray-900">FastAPI + React</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-gray-500">Database</span><span className="text-gray-900">SQLite</span>
          </div>
        </div>
      </div>

      {/* Modal Tambah Periode */}
      {showAddPeriodeModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="macos-card p-6 w-full max-w-md bg-white shadow-2xl rounded-apple-xl space-y-4 border border-gray-100 animate-scale-up">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                <h3 className="font-semibold text-gray-900 text-sm">Tambah Periode Baru</h3>
              </div>
              <button
                onClick={() => setShowAddPeriodeModal(false)}
                className="macos-button-ghost p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="macos-label">Tahun Akademik *</label>
                  <input
                    className="macos-input"
                    value={periodeForm.tahun_akademik}
                    onChange={(e) => handleTahunOrSemesterChange(e.target.value, periodeForm.semester_tipe)}
                    placeholder="2025/2026"
                  />
                </div>
                <div>
                  <label className="macos-label">Tipe Semester *</label>
                  <select
                    className="macos-input"
                    value={periodeForm.semester_tipe}
                    onChange={(e) => handleTahunOrSemesterChange(periodeForm.tahun_akademik, e.target.value)}
                  >
                    <option value="ganjil">Ganjil</option>
                    <option value="genap">Genap</option>
                    <option value="pendek">Pendek</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="macos-label">Nama Periode *</label>
                <input
                  className="macos-input"
                  value={periodeForm.nama}
                  onChange={(e) => setPeriodeForm({ ...periodeForm, nama: e.target.value })}
                  placeholder="2025/2026 Ganjil"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="macos-label">Kode Periode *</label>
                  <input
                    className="macos-input font-mono"
                    value={periodeForm.kode}
                    onChange={(e) => setPeriodeForm({ ...periodeForm, kode: e.target.value })}
                    placeholder="2025-1"
                  />
                </div>
                <div>
                  <label className="macos-label">Status</label>
                  <select
                    className="macos-input"
                    value={periodeForm.status}
                    onChange={(e) => setPeriodeForm({ ...periodeForm, status: e.target.value })}
                  >
                    <option value="aktif">Aktif</option>
                    <option value="selesai">Selesai</option>
                    <option value="arsip">Arsip</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={periodeForm.is_active}
                  onChange={(e) => setPeriodeForm({ ...periodeForm, is_active: e.target.checked })}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-gray-700 text-xs font-medium">Jadikan sebagai Periode Aktif saat ini</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowAddPeriodeModal(false)}
                className="macos-button-ghost px-3 py-1.5 text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCreatePeriode}
                disabled={savingPeriode}
                className="macos-button bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 text-xs font-medium"
              >
                {savingPeriode ? 'Menyimpan...' : 'Simpan Periode'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Periode */}
      {editingPeriode && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="macos-card p-6 w-full max-w-md bg-white shadow-2xl rounded-apple-xl space-y-4 border border-gray-100 animate-scale-up">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-indigo-600" />
                <h3 className="font-semibold text-gray-900 text-sm">Edit Periode Akademik</h3>
              </div>
              <button
                onClick={() => setEditingPeriode(null)}
                className="macos-button-ghost p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="macos-label">Tahun Akademik *</label>
                  <input
                    className="macos-input"
                    value={editingPeriode.tahun_akademik}
                    onChange={(e) => setEditingPeriode({ ...editingPeriode, tahun_akademik: e.target.value })}
                  />
                </div>
                <div>
                  <label className="macos-label">Tipe Semester *</label>
                  <select
                    className="macos-input"
                    value={editingPeriode.semester_tipe}
                    onChange={(e) => setEditingPeriode({ ...editingPeriode, semester_tipe: e.target.value })}
                  >
                    <option value="ganjil">Ganjil</option>
                    <option value="genap">Genap</option>
                    <option value="pendek">Pendek</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="macos-label">Nama Periode *</label>
                <input
                  className="macos-input"
                  value={editingPeriode.nama}
                  onChange={(e) => setEditingPeriode({ ...editingPeriode, nama: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="macos-label">Kode Periode *</label>
                  <input
                    className="macos-input font-mono"
                    value={editingPeriode.kode}
                    onChange={(e) => setEditingPeriode({ ...editingPeriode, kode: e.target.value })}
                  />
                </div>
                <div>
                  <label className="macos-label">Status</label>
                  <select
                    className="macos-input"
                    value={editingPeriode.status}
                    onChange={(e) => setEditingPeriode({ ...editingPeriode, status: e.target.value })}
                  >
                    <option value="aktif">Aktif</option>
                    <option value="selesai">Selesai</option>
                    <option value="arsip">Arsip</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={editingPeriode.is_active}
                  onChange={(e) => setEditingPeriode({ ...editingPeriode, is_active: e.target.checked })}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-gray-700 text-xs font-medium">Periode Aktif</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setEditingPeriode(null)}
                className="macos-button-ghost px-3 py-1.5 text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleUpdatePeriode}
                disabled={savingPeriode}
                className="macos-button bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 text-xs font-medium"
              >
                {savingPeriode ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
