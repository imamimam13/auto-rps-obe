import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, GraduationCap, ExternalLink, Upload, Link as LinkIcon, Edit2, Trash2, X } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'

interface Prodi {
  id: number
  kode: string
  nama: string
  fakultas: string
  visi: string
  misi: string
  status: string
  created_at: string
  ka_prodi?: string
  koordinator_rmk?: string
}

export default function ProdiList() {
  const [prodi, setProdi] = useState<Prodi[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    kode: '',
    nama: '',
    fakultas: '',
    visi: '',
    misi: '',
    ka_prodi: '',
    koordinator_rmk: '',
  })
  const [pdfUrl, setPdfUrl] = useState('')

  useEffect(() => {
    loadProdi()
  }, [])

  async function loadProdi() {
    try {
      const res = await api.get('/api/v1/prodi/?size=100')
      setProdi(res.data.items || [])
    } catch (e) {
      toast.error('Gagal memuat data prodi')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (editingId) {
        await api.put(`/api/v1/prodi/${editingId}`, formData)
        toast.success('Program studi berhasil diperbarui')
      } else {
        await api.post('/api/v1/prodi/', formData)
        toast.success('Program studi berhasil ditambahkan')
      }
      closeForm()
      loadProdi()
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Gagal menyimpan')
    }
  }

  function openCreateForm() {
    setEditingId(null)
    setFormData({ kode: '', nama: '', fakultas: '', visi: '', misi: '', ka_prodi: '', koordinator_rmk: '' })
    setShowForm(true)
  }

  function openEditForm(p: Prodi) {
    setEditingId(p.id)
    setFormData({
      kode: p.kode,
      nama: p.nama,
      fakultas: p.fakultas,
      visi: p.visi || '',
      misi: p.misi || '',
      ka_prodi: p.ka_prodi || '',
      koordinator_rmk: p.koordinator_rmk || '',
    })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setFormData({ kode: '', nama: '', fakultas: '', visi: '', misi: '', ka_prodi: '', koordinator_rmk: '' })
    setPdfUrl('')
  }

  async function handleDelete(id: number, nama: string) {
    if (!confirm(`Hapus program studi "${nama}"? Data terkait (Mata Kuliah, RPS) juga akan terhapus.`)) return
    try {
      await api.delete(`/api/v1/prodi/${id}`)
      toast.success('Program studi dihapus')
      loadProdi()
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Gagal menghapus')
    }
  }

  async function uploadPdfVisiMisi() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const form = new FormData()
      form.append('file', file)
      try {
        const res = await api.post('/api/v1/upload/pdf-prodi', form)
        setFormData(f => ({ ...f, visi: res.data.visi, misi: res.data.misi }))
        toast.success('Visi & Misi berhasil diekstrak dari PDF')
      } catch (e: any) {
        toast.error(e.response?.data?.detail || 'Gagal baca PDF')
      }
    }
    input.click()
  }

  async function fetchPdfFromUrl() {
    if (!pdfUrl) return
    try {
      const res = await api.post('/api/v1/upload/pdf-prodi-url', { url: pdfUrl })
      setFormData(f => ({ ...f, visi: res.data.visi, misi: res.data.misi }))
      toast.success('Visi & Misi berhasil dibaca dari URL')
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Gagal baca PDF dari URL')
    }
  }

  const filtered = prodi.filter(
    (p) =>
      p.nama.toLowerCase().includes(search.toLowerCase()) ||
      p.kode.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Program Studi</h1>
          <p className="text-sm text-gray-500 mt-1">Kelola data program studi</p>
        </div>
        <button onClick={openCreateForm} className="macos-button flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Tambah Prodi
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Cari program studi..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="macos-input pl-10"
        />
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="macos-window p-6 w-full max-w-lg mx-4 animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">
                {editingId ? 'Edit Program Studi' : 'Tambah Program Studi'}
              </h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingId && (
                <>
                  <button type="button" onClick={uploadPdfVisiMisi} className="macos-button w-full py-2 flex items-center justify-center gap-2 text-sm mb-2">
                    <Upload className="w-4 h-4" /> Upload PDF (Visi & Misi) — 1 file aja
                  </button>
                  <div className="flex gap-2">
                    <input
                      className="macos-input flex-1 text-sm"
                      value={pdfUrl}
                      onChange={(e) => setPdfUrl(e.target.value)}
                      placeholder="Atau masukkan URL PDF (Google Drive, dll)..."
                    />
                    <button type="button" onClick={fetchPdfFromUrl} className="macos-button px-3 flex items-center gap-1 text-sm">
                      <LinkIcon className="w-3.5 h-3.5" /> Baca URL
                    </button>
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="macos-label">Kode Prodi</label>
                  <input
                    className="macos-input"
                    value={formData.kode}
                    onChange={(e) => setFormData({ ...formData, kode: e.target.value })}
                    required
                    placeholder="mis: TI-001"
                  />
                </div>
                <div>
                  <label className="macos-label">Fakultas</label>
                  <input
                    className="macos-input"
                    value={formData.fakultas}
                    onChange={(e) => setFormData({ ...formData, fakultas: e.target.value })}
                    required
                    placeholder="mis: FTI"
                  />
                </div>
              </div>
              <div>
                <label className="macos-label">Nama Program Studi</label>
                <input
                  className="macos-input"
                  value={formData.nama}
                  onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                  required
                  placeholder="mis: Teknik Informatika"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="macos-label">Ketua Program Studi (Ka Prodi)</label>
                  <input
                    className="macos-input"
                    value={formData.ka_prodi}
                    onChange={(e) => setFormData({ ...formData, ka_prodi: e.target.value })}
                    placeholder="Nama Ka Prodi"
                  />
                </div>
                <div>
                  <label className="macos-label">Koordinator Rumpun MK (RMK)</label>
                  <input
                    className="macos-input"
                    value={formData.koordinator_rmk}
                    onChange={(e) => setFormData({ ...formData, koordinator_rmk: e.target.value })}
                    placeholder="Nama Koordinator RMK"
                  />
                </div>
              </div>
              <div>
                <label className="macos-label">Visi</label>
                <textarea
                  className="macos-input min-h-[80px] resize-none"
                  value={formData.visi}
                  onChange={(e) => setFormData({ ...formData, visi: e.target.value })}
                  required
                  placeholder="Visi program studi..."
                />
              </div>
              <div>
                <label className="macos-label">Misi</label>
                <textarea
                  className="macos-input min-h-[80px] resize-none"
                  value={formData.misi}
                  onChange={(e) => setFormData({ ...formData, misi: e.target.value })}
                  required
                  placeholder="Misi program studi..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeForm} className="macos-button-ghost">
                  Batal
                </button>
                <button type="submit" className="macos-button">
                  {editingId ? 'Update' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Memuat...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Belum ada data program studi</div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((p) => (
            <div key={p.id} className="macos-card p-4 flex items-center gap-4 group hover:border-macos-blue/20">
              <Link to={`/prodi/${p.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                <div className="p-3 rounded-apple-lg bg-blue-50">
                  <GraduationCap className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 group-hover:text-macos-blue transition-colors">
                    {p.nama}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {p.kode} · {p.fakultas}
                  </p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  p.status === 'aktif' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-500'
                }`}>
                  {p.status}
                </span>
                <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-macos-blue transition-colors" />
              </Link>
              <div className="flex items-center gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.preventDefault(); openEditForm(p) }}
                  className="p-2 rounded-apple hover:bg-blue-50 text-gray-400 hover:text-macos-blue transition-colors"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => { e.preventDefault(); handleDelete(p.id, p.nama) }}
                  className="p-2 rounded-apple hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                  title="Hapus"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
