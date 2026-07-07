import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, BookOpen, Sparkles, FileText } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'

export default function MataKuliahDetail() {
  const { id } = useParams()
  const [mk, setMk] = useState<any>(null)
  const [prodi, setProdi] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) loadData()
  }, [id])

  async function loadData() {
    try {
      const res = await api.get(`/api/v1/mata-kuliah/${id}`)
      setMk(res.data)
      if (res.data.prodi_id) {
        const pRes = await api.get(`/api/v1/prodi/${res.data.prodi_id}`)
        setProdi(pRes.data)
      }
    } catch (e) {
      toast.error('Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }

  if (loading || !mk) return <div className="text-center py-12 text-gray-400">Memuat...</div>

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <Link to="/mata-kuliah" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-macos-blue transition-colors">
        <ArrowLeft className="w-4 h-4" /> Kembali
      </Link>

      <div className="macos-card p-6">
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-apple-xl bg-gradient-to-br from-orange-500 to-red-500">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-gray-900">{mk.nama}</h1>
            <p className="text-sm text-gray-500">{mk.kode} · {mk.sks} SKS (T:{mk.sks_teori} P:{mk.sks_praktik}) · Semester {mk.semester}</p>
            {prodi && <p className="text-xs text-gray-400 mt-0.5">{prodi.nama}</p>}
          </div>
          <Link to={`/rps/generate/${mk.id}`} className="macos-button flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Generate RPS
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="macos-card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Deskripsi</h3>
          <p className="text-sm text-gray-600 leading-relaxed">{mk.deskripsi || 'Tidak ada deskripsi'}</p>
        </div>
        <div className="macos-card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Informasi</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Prasyarat</span><span>{mk.prasyarat?.length ? mk.prasyarat.join(', ') : '-'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">CPL Terkait</span><span>{mk.cpl_prodi?.length || 0} CPL</span></div>
            <div className="flex justify-between"><span className="text-gray-500">CPMK</span><span>{mk.cpmk?.length || 0} CPMK</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Sub-CPMK</span><span>{mk.sub_cpmk?.length || 0} Sub-CPMK</span></div>
          </div>
        </div>
      </div>

      {mk.cpmk?.length > 0 && (
        <div className="macos-card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">CPMK</h3>
          <div className="space-y-2">
            {mk.cpmk.map((c: any, i: number) => (
              <div key={i} className="p-3 bg-gray-50/50 rounded-apple-lg">
                <span className="text-xs font-mono font-bold text-macos-blue bg-blue-50 px-2 py-0.5 rounded">{c.kode}</span>
                <p className="text-sm text-gray-700 mt-1">{c.deskripsi}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {mk.buku_teks?.length > 0 && (
        <div className="macos-card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Referensi</h3>
          <ul className="space-y-1 text-sm text-gray-600 list-disc list-inside">
            {mk.buku_teks.map((b: any, i: number) => (
              <li key={i}>{b.judul || b}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}