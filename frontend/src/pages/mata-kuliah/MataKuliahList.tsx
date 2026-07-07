import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, BookOpen, Sparkles, Filter } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'

export default function MataKuliahList() {
  const [mkList, setMkList] = useState<any[]>([])
  const [prodiList, setProdiList] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filterProdi, setFilterProdi] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [filterProdi])

  async function loadData() {
    try {
      const params = filterProdi ? `?prodi_id=${filterProdi}&size=50` : '?size=50'
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

      {loading ? (
        <div className="text-center py-12 text-gray-400">Memuat...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Tidak ada mata kuliah</div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((mk) => (
            <Link key={mk.id} to={`/mata-kuliah/${mk.id}`} className="macos-card p-4 flex items-center gap-4 group">
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
          ))}
        </div>
      )}
    </div>
  )
}