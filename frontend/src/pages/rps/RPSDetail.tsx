import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, FileText, CheckSquare, Download, Sparkles } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'

export default function RPSDetail() {
  const { id } = useParams()
  const [rps, setRps] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [validating, setValidating] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editJson, setEditJson] = useState('')

  useEffect(() => {
    if (id) loadData()
  }, [id])

  async function loadData() {
    try {
      const res = await api.get(`/api/v1/rps/${id}`)
      setRps(res.data)
    } catch (e) {
      toast.error('Gagal memuat RPS')
    } finally {
      setLoading(false)
    }
  }

  async function handleValidate() {
    setValidating(true)
    try {
      const res = await api.post('/api/v1/generate/validate-obe', { rps_id: Number(id) })
      toast.success(`Validasi OBE selesai: Skor ${res.data.score}`)
      loadData()
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Gagal validasi')
    } finally {
      setValidating(false)
    }
  }

  async function handleUpdateStatus(newStatus: string) {
    setUpdatingStatus(true)
    try {
      if (newStatus === 'approved') {
        await api.post(`/api/v1/rps/${id}/approve`)
      } else {
        await api.put(`/api/v1/rps/${id}`, { status: newStatus })
      }
      toast.success(`Status RPS diperbarui menjadi ${newStatus}`)
      loadData()
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Gagal memperbarui status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  function openEditModal() {
    if (!rps) return
    const editableData = {
      identitas: rps.identitas,
      cpmk: rps.cpmk,
      sub_cpmk: rps.sub_cpmk,
      rencana_pembelajaran: rps.rencana_pembelajaran,
      metode_pembelajaran: rps.metode_pembelajaran,
      media_pembelajaran: rps.media_pembelajaran,
      penilaian: rps.penilaian,
      referensi: rps.referensi,
    }
    setEditJson(JSON.stringify(editableData, null, 2))
    setShowEditModal(true)
  }

  async function handleSaveJson() {
    try {
      const parsed = JSON.parse(editJson)
      await api.put(`/api/v1/rps/${id}`, parsed)
      toast.success('RPS berhasil diperbarui!')
      setShowEditModal(false)
      loadData()
    } catch (e: any) {
      if (e instanceof SyntaxError) {
        toast.error('Format JSON tidak valid! Periksa kembali kurung atau koma.')
      } else {
        toast.error(e.response?.data?.detail || 'Gagal memperbarui RPS')
      }
    }
  }

  async function handleExport(format: string) {
    try {
      const res = await api.post(`/api/v1/export/${id}?export_format=${format}`, {}, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `RPS-${id}.${format}`
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success(`Export ${format.toUpperCase()} berhasil`)
    } catch (e) {
      toast.error('Gagal export')
    }
  }

  if (loading || !rps) return <div className="text-center py-12 text-gray-400">Memuat...</div>

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <div className="flex items-center justify-between">
        <Link to="/rps" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-macos-blue transition-colors">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </Link>
        <div className="flex items-center gap-2">
          {rps.status === 'draft' && (
            <button
              onClick={() => handleUpdateStatus('review')}
              disabled={updatingStatus}
              className="macos-button flex items-center gap-1 bg-yellow-500 hover:bg-yellow-600 text-white text-xs px-3 py-1.5 rounded-apple-md font-medium"
            >
              Ajukan Review
            </button>
          )}
          {(rps.status === 'draft' || rps.status === 'review') && (
            <button
              onClick={() => handleUpdateStatus('approved')}
              disabled={updatingStatus}
              className="macos-button flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white text-xs px-3 py-1.5 rounded-apple-md font-medium"
            >
              Setujui (Approve)
            </button>
          )}
          {rps.status === 'approved' && (
            <button
              onClick={() => handleUpdateStatus('published')}
              disabled={updatingStatus}
              className="macos-button flex items-center gap-1 bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-1.5 rounded-apple-md font-medium"
            >
              Publikasikan
            </button>
          )}
          {rps.status === 'draft' && (
            <button onClick={openEditModal} className="macos-button-ghost flex items-center gap-1.5 text-sm">
              <Sparkles className="w-4 h-4 text-purple-500" /> Edit RPS (JSON)
            </button>
          )}
          <button onClick={handleValidate} disabled={validating} className="macos-button-ghost flex items-center gap-1.5 text-sm">
            <CheckSquare className="w-4 h-4" /> {validating ? 'Memvalidasi...' : 'Validasi OBE'}
          </button>
          <button onClick={() => handleExport('pdf')} className="macos-button-ghost flex items-center gap-1.5 text-sm">
            <Download className="w-4 h-4" /> PDF
          </button>
          <button onClick={() => handleExport('docx')} className="macos-button-ghost flex items-center gap-1.5 text-sm">
            <FileText className="w-4 h-4" /> DOCX
          </button>
        </div>
      </div>

      {/* Identitas */}
      <div className="macos-card p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-4 rounded-apple-xl bg-gradient-to-br from-green-500 to-emerald-600">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{rps.kode}</h1>
            <p className="text-sm text-gray-500">{rps.identitas?.nama_mata_kuliah} · Semester {rps.semester} · {rps.tahun_akademik}</p>
          </div>
          <span className={`ml-auto text-xs font-medium px-3 py-1 rounded-full ${
            rps.status === 'approved' ? 'bg-green-50 text-green-600' : 
            rps.status === 'published' ? 'bg-blue-50 text-blue-600' : 
            rps.status === 'draft' ? 'bg-gray-50 text-gray-600' : 'bg-yellow-50 text-yellow-600'
          }`}>{rps.status}</span>
        </div>
        {rps.obe_validated && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-apple-lg text-sm text-blue-700">
            <CheckSquare className="w-4 h-4" /> Validasi OBE: Skor {rps.obe_score}/100
          </div>
        )}
      </div>

      {/* CPMK */}
      {rps.cpmk?.length > 0 && (
        <div className="macos-card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">CPMK ({rps.cpmk.length})</h3>
          <div className="space-y-2">
            {rps.cpmk.map((c: any, i: number) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-gray-50/50 rounded-apple-lg">
                <span className="text-xs font-mono font-bold text-macos-blue bg-blue-50 px-2 py-0.5 rounded shrink-0">{c.kode}</span>
                <div className="flex-1">
                  <p className="text-sm text-gray-700">{c.deskripsi}</p>
                  <p className="text-xs text-gray-400 mt-1">Bobot: {c.bobot} | CPL: {c.cpl_prodi?.join(', ')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rencana Pembelajaran */}
      {rps.rencana_pembelajaran?.length > 0 && (
        <div className="macos-card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Rencana Pembelajaran (16 Minggu)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Minggu</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Sub-CPMK</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Materi</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Metode</th>
                </tr>
              </thead>
              <tbody>
                {rps.rencana_pembelajaran.map((r: any) => (
                  <tr key={r.minggu_ke} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="py-2.5 px-3 font-mono text-xs">{r.minggu_ke}</td>
                    <td className="py-2.5 px-3 text-xs text-gray-500">{r.sub_cpmk_kode}</td>
                    <td className="py-2.5 px-3 text-gray-700">{r.materi}</td>
                    <td className="py-2.5 px-3 text-xs text-gray-500">{r.metode?.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Penilaian */}
      {rps.penilaian?.length > 0 && (
        <div className="macos-card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Penilaian</h3>
          <div className="grid grid-cols-3 gap-3">
            {rps.penilaian.map((p: any, i: number) => (
              <div key={i} className="p-3 bg-gray-50/50 rounded-apple-lg">
                <p className="text-sm font-medium text-gray-900">{p.komponen}</p>
                <p className="text-xs text-gray-500 mt-1">Bobot: {(p.bobot * 100).toFixed(0)}% · {p.jenis}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Edit JSON Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="macos-card p-6 w-full max-w-3xl h-[85vh] flex flex-col animate-scale-up space-y-4 bg-white/95 shadow-2xl rounded-apple-xl border border-white/20">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Edit Konten RPS (Format JSON)</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Ubah isi RPS secara langsung. Pastikan format JSON tetap valid.</p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xs"
              >
                Tutup
              </button>
            </div>

            <div className="flex-1 min-h-0">
              <textarea
                className="w-full h-full p-4 font-mono text-xs bg-gray-50 border border-gray-200 rounded-apple-lg focus:outline-none focus:ring-1 focus:ring-macos-blue resize-none"
                value={editJson}
                onChange={(e) => setEditJson(e.target.value)}
                spellCheck={false}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowEditModal(false)}
                className="macos-button-ghost px-4 py-2 text-xs"
              >
                Batal
              </button>
              <button
                onClick={handleSaveJson}
                className="macos-button py-2.5 px-4 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-medium text-xs rounded-apple-lg"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}