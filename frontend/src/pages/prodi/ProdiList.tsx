import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, GraduationCap, ExternalLink, Upload } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'

interface Prodi {
  id: number
  kode: string
  nama: string
  fakultas: string
  status: string
  created_at: string
}

export default function ProdiList() {
  const [prodi, setProdi] = useState<Prodi[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    kode: '',
    nama: '',
    fakultas: '',
    visi: '',
    misi: '',
  })

  useEffect(() => {
    loadProdi()
  }, [])

  async function loadProdi() {
    try {
      const res = await api.get('/api/v1/prodi/?size=50')
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
      await api.post('/api/v1/prodi/', formData)
      toast.success('Program studi berhasil ditambahkan')
      setShowForm(false)
      setFormData({ kode: '', nama: '', fakultas: '', visi: '', misi: '' })
      loadProdi()
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Gagal menyimpan')
    }
  }

  async function uploadPdf(target: 'visi' | 'misi') {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const form = new FormData()
      form.append('file', file)
      try {
        const res = await api.post('/api/v1/upload/pdf', form)
        setFormData(f => ({ ...f, [target]: res.data.text }))
        toast.success(`Teks ${target} berhasil diekstrak dari PDF`)
      } catch (e: any) {
        toast.error(e.response?.data?.detail || 'Gagal baca PDF')
      }
    }
    input.click()
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
        <button onClick={() => setShowForm(true)} className="macos-button flex items-center gap-2">
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
          <div className="macos-window p-6 w-full max-w-lg mx-4 animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">Tambah Program Studi</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
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
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="macos-label">Visi</label>
                  <button type="button" onClick={() => uploadPdf('visi')} className="text-xs text-macos-blue hover:text-blue-600 flex items-center gap-1">
                    <Upload className="w-3 h-3" /> Upload PDF
                  </button>
                </div>
                <textarea
                  className="macos-input min-h-[80px] resize-none"
                  value={formData.visi}
                  onChange={(e) => setFormData({ ...formData, visi: e.target.value })}
                  required
                  placeholder="Visi program studi..."
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="macos-label">Misi</label>
                  <button type="button" onClick={() => uploadPdf('misi')} className="text-xs text-macos-blue hover:text-blue-600 flex items-center gap-1">
                    <Upload className="w-3 h-3" /> Upload PDF
                  </button>
                </div>
                <textarea
                  className="macos-input min-h-[80px] resize-none"
                  value={formData.misi}
                  onChange={(e) => setFormData({ ...formData, misi: e.target.value })}
                  required
                  placeholder="Misi program studi..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="macos-button-ghost">
                  Batal
                </button>
                <button type="submit" className="macos-button">
                  Simpan
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
            <Link
              key={p.id}
              to={`/prodi/${p.id}`}
              className="macos-card p-4 flex items-center gap-4 group"
            >
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
          ))}
        </div>
      )}
    </div>
  )
}