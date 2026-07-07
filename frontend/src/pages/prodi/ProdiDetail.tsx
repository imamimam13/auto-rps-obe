import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, BookOpen, FileText, Sparkles } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'

interface Prodi {
  id: number; kode: string; nama: string; fakultas: string
  visi: string; misi: string; tujuan: string; sasaran: string
  capaian_pembelajaran_lulusan: any[]; status: string
}

export default function ProdiDetail() {
  const { id } = useParams()
  const [prodi, setProdi] = useState<Prodi | null>(null)
  const [mkList, setMkList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) loadData()
  }, [id])

  async function loadData() {
    try {
      const [pRes, mkRes] = await Promise.all([
        api.get(`/api/v1/prodi/${id}`),
        api.get(`/api/v1/mata-kuliah/?prodi_id=${id}&size=50`),
      ])
      setProdi(pRes.data)
      setMkList(mkRes.data.items || [])
    } catch (e) {
      toast.error('Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }

  if (loading || !prodi) return <div className="text-center py-12 text-gray-400">Memuat...</div>

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <Link to="/prodi" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-macos-blue transition-colors">
        <ArrowLeft className="w-4 h-4" /> Kembali
      </Link>

      <div className="macos-card p-6">
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-apple-xl bg-gradient-to-br from-blue-500 to-blue-600">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{prodi.nama}</h1>
            <p className="text-sm text-gray-500">{prodi.kode} · {prodi.fakultas}</p>
          </div>
        </div>
      </div>

      {/* Visi Misi */}
      <div className="grid grid-cols-2 gap-4">
        <div className="macos-card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Visi</h3>
          <p className="text-sm text-gray-600 leading-relaxed">{prodi.visi}</p>
        </div>
        <div className="macos-card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Misi</h3>
          <p className="text-sm text-gray-600 leading-relaxed">{prodi.misi}</p>
        </div>
      </div>

      {/* CPL */}
      <div className="macos-card p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Capaian Pembelajaran Lulusan (CPL)</h3>
        {prodi.capaian_pembelajaran_lulusan?.length > 0 ? (
          <div className="space-y-2">
            {prodi.capaian_pembelajaran_lulusan.map((cpl: any, i: number) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-gray-50/50 rounded-apple-lg">
                <span className="text-xs font-mono font-bold text-macos-blue bg-blue-50 px-2 py-0.5 rounded">
                  {cpl.kode}
                </span>
                <p className="text-sm text-gray-700">{cpl.deskripsi}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">Belum ada CPL</p>
        )}
      </div>

      {/* Mata Kuliah */}
      <div className="macos-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Daftar Mata Kuliah ({mkList.length})</h3>
          <Link
            to={`/mata-kuliah?prodi_id=${prodi.id}`}
            className="text-xs text-macos-blue hover:text-blue-600 font-medium"
          >
            Lihat semua
          </Link>
        </div>
        <div className="space-y-2">
          {mkList.slice(0, 10).map((mk) => (
            <Link
              key={mk.id}
              to={`/mata-kuliah/${mk.id}`}
              className="flex items-center gap-3 p-3 rounded-apple-lg hover:bg-gray-50/70 transition-colors"
            >
              <FileText className="w-4 h-4 text-orange-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{mk.nama}</p>
                <p className="text-xs text-gray-500">{mk.kode} · {mk.sks} SKS · Semester {mk.semester}</p>
              </div>
              <Sparkles className="w-3.5 h-3.5 text-gray-300" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}