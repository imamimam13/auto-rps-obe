import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, BookOpen, Sparkles, Upload, Edit2, Trash2, X, CheckSquare, Square, Trash } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { SDGS_LIST } from '@/utils/sdgsData'

interface MK {
  id: number
  kode: string
  nama: string
  sks: number
  sks_teori: number
  sks_praktik: number
  semester: number
  prodi_id: number
  deskripsi: string
  sdgs?: number[]
}

interface Prodi {
  id: number
  nama: string
}

export default function MataKuliahList() {
  const [mkList, setMkList] = useState<MK[]>([])
  const [prodiList, setProdiList] = useState<Prodi[]>([])
  const [search, setSearch] = useState('')
  const [filterProdi, setFilterProdi] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [selectedSDGs, setSelectedSDGs] = useState<number[]>([])
  // Bulk delete state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [formData, setFormData] = useState({
    kode: '',
    nama: '',
    sks: 3,
    sks_teori: 2,
    sks_praktik: 1,
    semester: 1,
    prodi_id: '',
    deskripsi: '',
  })

  useEffect(() => {
    loadData()
  }, [filterProdi])

  async function loadData() {
    try {
      const params = filterProdi ? `?prodi_id=${filterProdi}&size=100` : '?size=100'
      const [mkRes, pRes] = await Promise.all([
        api.get(`/api/v1/mata-kuliah/${params}`),
        api.get('/api/v1/prodi/?size=50'),
      ])
      setMkList(mkRes.data.items || [])
      setProdiList(pRes.data.items || [])
    } catch (e) {
      toast.error('Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      ...formData,
      prodi_id: parseInt(formData.prodi_id),
      sks_teori: formData.sks_teori,
      sks_praktik: formData.sks_praktik,
      semester: formData.semester,
      sks: formData.sks_teori + formData.sks_praktik,
      sdgs: selectedSDGs,
    }
    try {
      if (editingId) {
        await api.put(`/api/v1/mata-kuliah/${editingId}`, payload)
        toast.success('Mata kuliah diperbarui')
      } else {
        await api.post('/api/v1/mata-kuliah/', payload)
        toast.success('Mata kuliah ditambahkan')
      }
      closeForm()
      loadData()
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Gagal menyimpan')
    }
  }

  function openCreateForm() {
    setEditingId(null)
    setFormData({
      kode: '',
      nama: '',
      sks: 3,
      sks_teori: 2,
      sks_praktik: 1,
      semester: 1,
      prodi_id: '',
      deskripsi: '',
    })
    setSelectedSDGs([])
    setShowForm(true)
  }

  function openEditForm(mk: MK) {
    setEditingId(mk.id)
    setFormData({
      kode: mk.kode,
      nama: mk.nama,
      sks: mk.sks,
      sks_teori: mk.sks_teori,
      sks_praktik: mk.sks_praktik,
      semester: mk.semester,
      prodi_id: mk.prodi_id.toString(),
      deskripsi: mk.deskripsi || '',
    })
    setSelectedSDGs(mk.sdgs || [])
    setShowForm(true)
  }

  function handleSDGChange(id: number) {
    setSelectedSDGs((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
  }

  async function handleDelete(id: number, nama: string) {
    if (!confirm(`Hapus mata kuliah "${nama}"?`)) return
    try {
      await api.delete(`/api/v1/mata-kuliah/${id}`)
      toast.success('Mata kuliah dihapus')
      loadData()
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Gagal menghapus')
    }
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((mk) => mk.id)))
    }
  }

  function toggleSelect(id: number) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  function exitBulkMode() {
    setBulkMode(false)
    setSelectedIds(new Set())
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return
    if (!confirm(`Hapus ${selectedIds.size} mata kuliah terpilih? Tindakan ini tidak dapat dibatalkan.`)) return
    setBulkDeleting(true)
    try {
      const res = await api.delete('/api/v1/mata-kuliah/bulk', { data: { ids: Array.from(selectedIds) } })
      toast.success(`${res.data.deleted} mata kuliah berhasil dihapus`)
      exitBulkMode()
      loadData()
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Gagal menghapus')
    } finally {
      setBulkDeleting(false)
    }
  }

  const filtered = mkList.filter(
    (mk) =>
      mk.nama?.toLowerCase().includes(search.toLowerCase()) ||
      mk.kode?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Mata Kuliah</h1>
          <p className="text-sm text-gray-500 mt-1">Kelola mata kuliah</p>
        </div>
        <div className="flex gap-2">
          {bulkMode ? (
            <button onClick={exitBulkMode} className="macos-button-ghost flex items-center gap-2 text-sm">
              <X className="w-4 h-4" /> Batal Pilih
            </button>
          ) : (
            <>
              <button
                onClick={() => setBulkMode(true)}
                className="macos-button-ghost flex items-center gap-2 text-sm"
              >
                <CheckSquare className="w-4 h-4" /> Pilih Massal
              </button>
              <button onClick={openCreateForm} className="macos-button flex items-center gap-2">
                <Plus className="w-4 h-4" /> Tambah
              </button>
              <Link to="/mata-kuliah/bulk-import" className="macos-button-ghost flex items-center gap-2 text-sm">
                <Upload className="w-4 h-4" /> Import Bulk
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Cari mata kuliah..." value={search} onChange={(e) => setSearch(e.target.value)} className="macos-input pl-10" />
        </div>
        <select value={filterProdi} onChange={(e) => setFilterProdi(e.target.value)} className="macos-input max-w-[200px]">
          <option value="">Semua Prodi</option>
          {prodiList.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
        </select>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="macos-window p-6 w-full max-w-lg mx-4 animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">{editingId ? 'Edit Mata Kuliah' : 'Tambah Mata Kuliah'}</h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="macos-label">Kode MK</label>
                  <input className="macos-input" value={formData.kode} onChange={(e) => setFormData({ ...formData, kode: e.target.value })} required placeholder="TI-101" />
                </div>
                <div>
                  <label className="macos-label">Prodi</label>
                  <select className="macos-input" value={formData.prodi_id} onChange={(e) => setFormData({ ...formData, prodi_id: e.target.value })} required>
                    <option value="">Pilih Prodi</option>
                    {prodiList.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="macos-label">Nama Mata Kuliah</label>
                <input className="macos-input" value={formData.nama} onChange={(e) => setFormData({ ...formData, nama: e.target.value })} required placeholder="Algoritma dan Pemrograman" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="macos-label">Semester</label>
                  <input type="number" className="macos-input" value={formData.semester} onChange={(e) => setFormData({ ...formData, semester: parseInt(e.target.value) })} min="1" max="8" />
                </div>
                <div>
                  <label className="macos-label">SKS Teori</label>
                  <input type="number" className="macos-input" value={formData.sks_teori} onChange={(e) => setFormData({ ...formData, sks_teori: parseInt(e.target.value) })} min="0" max="6" />
                </div>
                <div>
                  <label className="macos-label">SKS Praktik</label>
                  <input type="number" className="macos-input" value={formData.sks_praktik} onChange={(e) => setFormData({ ...formData, sks_praktik: parseInt(e.target.value) })} min="0" max="6" />
                </div>
              </div>
              <div>
                <label className="macos-label">Deskripsi</label>
                <textarea className="macos-input min-h-[80px]" value={formData.deskripsi} onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })} placeholder="Deskripsi mata kuliah..." />
              </div>
              <div>
                <label className="macos-label">SDGs Terkait (Sustainable Development Goals)</label>
                <div className="grid grid-cols-2 gap-2 mt-1.5 max-h-36 overflow-y-auto p-2 bg-gray-50/50 rounded-apple-lg border border-gray-200/50">
                  {SDGS_LIST.map((sdg) => {
                    const isChecked = selectedSDGs.includes(sdg.id)
                    return (
                      <label key={sdg.id} className="flex items-start gap-1.5 text-[11px] cursor-pointer hover:bg-gray-100/50 p-1 rounded-apple">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleSDGChange(sdg.id)}
                          className="mt-0.5 rounded border-gray-300 text-macos-blue focus:ring-macos-blue w-3 h-3"
                        />
                        <span className="leading-tight select-none" style={{ color: sdg.color, fontWeight: isChecked ? 600 : 400 }}>
                          {sdg.id}. {sdg.name}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeForm} className="macos-button-ghost">Batal</button>
                <button type="submit" className="macos-button">{editingId ? 'Update' : 'Simpan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Select-all bar – visible only in bulk mode */}
      {bulkMode && !loading && filtered.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 rounded-apple bg-blue-50 border border-blue-100">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-sm font-medium text-macos-blue"
          >
            {selectedIds.size === filtered.length
              ? <CheckSquare className="w-4 h-4" />
              : <Square className="w-4 h-4" />}
            {selectedIds.size === filtered.length ? 'Batal pilih semua' : 'Pilih semua'}
          </button>
          <span className="text-xs text-gray-500 ml-auto">{selectedIds.size} dari {filtered.length} dipilih</span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Memuat...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Tidak ada mata kuliah</div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((mk) => (
            <div
              key={mk.id}
              className={`macos-card p-4 flex items-center gap-4 group hover:border-macos-blue/20 transition-colors ${
                bulkMode && selectedIds.has(mk.id) ? 'border-macos-blue/40 bg-blue-50/50' : ''
              }`}
            >
              {/* Checkbox in bulk mode */}
              {bulkMode && (
                <button
                  onClick={() => toggleSelect(mk.id)}
                  className="flex-shrink-0 text-macos-blue"
                >
                  {selectedIds.has(mk.id)
                    ? <CheckSquare className="w-5 h-5" />
                    : <Square className="w-5 h-5 text-gray-300" />}
                </button>
              )}

              {bulkMode ? (
                <button
                  onClick={() => toggleSelect(mk.id)}
                  className="flex items-center gap-4 flex-1 min-w-0 text-left"
                >
                  <div className="p-3 rounded-apple-lg bg-orange-50">
                    <BookOpen className="w-5 h-5 text-orange-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900">{mk.nama}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{mk.kode} · {mk.sks} SKS · Semester {mk.semester}</p>
                  </div>
                </button>
              ) : (
                <Link to={`/mata-kuliah/${mk.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="p-3 rounded-apple-lg bg-orange-50">
                    <BookOpen className="w-5 h-5 text-orange-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 group-hover:text-macos-blue transition-colors">{mk.nama}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{mk.kode} · {mk.sks} SKS · Semester {mk.semester}</p>
                  </div>
                  <Link to={`/rps/generate/${mk.id}`} className="macos-button-ghost text-xs flex items-center gap-1.5 px-3 py-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Generate RPS
                  </Link>
                </Link>
              )}

              {!bulkMode && (
                <div className="flex items-center gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.preventDefault(); openEditForm(mk) }} className="p-2 rounded-apple hover:bg-blue-50 text-gray-400 hover:text-macos-blue" title="Edit">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={(e) => { e.preventDefault(); handleDelete(mk.id, mk.nama) }} className="p-2 rounded-apple hover:bg-red-50 text-gray-400 hover:text-red-500" title="Hapus">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Floating bulk-delete action bar */}
      {bulkMode && selectedIds.size > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
          }}
          className="flex items-center gap-4 px-6 py-3 rounded-full shadow-2xl bg-gray-900 text-white border border-gray-700"
        >
          <span className="text-sm font-medium">{selectedIds.size} dipilih</span>
          <div className="w-px h-4 bg-gray-600" />
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="flex items-center gap-2 text-sm font-semibold text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
          >
            <Trash className="w-4 h-4" />
            {bulkDeleting ? 'Menghapus...' : 'Hapus Terpilih'}
          </button>
          <button
            onClick={exitBulkMode}
            className="p-1 rounded-full hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
