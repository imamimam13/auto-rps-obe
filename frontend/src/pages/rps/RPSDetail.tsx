import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, CheckSquare, Download, Sparkles, Trash2 } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'

function formatApiError(e: any, fallback: string): string {
  if (e?.response?.data?.detail) {
    const detail = e.response.data.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      return detail.map((err: any) => {
        const path = err.loc ? err.loc.join('.') : 'field'
        return `${path}: ${err.msg}`
      }).join(', ')
    }
  }
  return e?.message || fallback
}

export default function RPSDetail() {
  const { id } = useParams()
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [rps, setRps] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [validating, setValidating] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editJson, setEditJson] = useState('')
  const [activeTab, setActiveTab] = useState<string>('identitas')
  const [formIdentitas, setFormIdentitas] = useState({
    tanggal_penyusunan: '',
    no_dokumen: '',
    koordinator_pengembang_rps: '',
    koordinator_rmk: '',
    ka_prodi: '',
    nama_mata_kuliah: '',
    kode_mata_kuliah: '',
    sks: 3,
    semester: 3
  })
  const [formBahanKajian, setFormBahanKajian] = useState<string[]>([])
  const [formCPMK, setFormCPMK] = useState<any[]>([])
  const [formSubCPMK, setFormSubCPMK] = useState<any[]>([])
  const [formRencanaPembelajaran, setFormRencanaPembelajaran] = useState<any[]>([])
  const [formMedia, setFormMedia] = useState<any>({ software: [], hardware: [] })
  const [formReferensi, setFormReferensi] = useState<any>({ utama: [], pendukung: [] })
  const [formPenilaian, setFormPenilaian] = useState<any[]>([])
  const [fixing, setFixing] = useState(false)

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
      toast.error(formatApiError(e, 'Gagal validasi'))
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
      toast.error(formatApiError(e, 'Gagal memperbarui status'))
    } finally {
      setUpdatingStatus(false)
    }
  }

  function openEditModal() {
    if (!rps) return
    const editableData = {
      identitas: rps.identitas || {},
      bahan_kajian: rps.bahan_kajian || [],
      cpmk: rps.cpmk || [],
      sub_cpmk: rps.sub_cpmk || [],
      rencana_pembelajaran: rps.rencana_pembelajaran || [],
      media_pembelajaran: rps.media_pembelajaran || {},
      penilaian: rps.penilaian || [],
      referensi: rps.referensi || {},
    }
    setEditJson(JSON.stringify(editableData, null, 2))
    setFormIdentitas({
      tanggal_penyusunan: rps.identitas?.tanggal_penyusunan || '',
      no_dokumen: rps.identitas?.no_dokumen || '',
      koordinator_pengembang_rps: rps.identitas?.koordinator_pengembang_rps || '',
      koordinator_rmk: rps.identitas?.koordinator_rmk || '',
      ka_prodi: rps.identitas?.ka_prodi || '',
      nama_mata_kuliah: rps.identitas?.nama_mata_kuliah || '',
      kode_mata_kuliah: rps.identitas?.kode_mata_kuliah || '',
      sks: rps.identitas?.sks || 3,
      semester: rps.identitas?.semester || 3
    })
    
    setFormBahanKajian(rps.bahan_kajian || [])
    setFormCPMK(rps.cpmk || [])
    setFormSubCPMK(rps.sub_cpmk || [])
    setFormRencanaPembelajaran(rps.rencana_pembelajaran || [])
    
    // Handle Media parsing
    const mediaObj = rps.media_pembelajaran || {}
    if (Array.isArray(mediaObj)) {
      setFormMedia({ software: mediaObj, hardware: [] })
    } else {
      setFormMedia({
        software: mediaObj.software || [],
        hardware: mediaObj.hardware || []
      })
    }
    
    // Handle Referensi parsing
    const refObj = rps.referensi || {}
    if (Array.isArray(refObj)) {
      setFormReferensi({ utama: refObj, pendukung: [] })
    } else {
      setFormReferensi({
        utama: refObj.utama || [],
        pendukung: refObj.pendukung || []
      })
    }
    
    setFormPenilaian(rps.penilaian || [])
    setActiveTab('identitas')
    setShowEditModal(true)
  }

  async function handleSaveJson() {
    try {
      const parsed = {
        identitas: {
          ...rps?.identitas,
          tanggal_penyusunan: formIdentitas.tanggal_penyusunan,
          no_dokumen: formIdentitas.no_dokumen,
          koordinator_pengembang_rps: formIdentitas.koordinator_pengembang_rps,
          koordinator_rmk: formIdentitas.koordinator_rmk,
          ka_prodi: formIdentitas.ka_prodi,
          nama_mata_kuliah: formIdentitas.nama_mata_kuliah,
          kode_mata_kuliah: formIdentitas.kode_mata_kuliah,
          sks: Number(formIdentitas.sks),
          semester: Number(formIdentitas.semester)
        },
        bahan_kajian: formBahanKajian,
        cpmk: formCPMK,
        sub_cpmk: formSubCPMK,
        rencana_pembelajaran: formRencanaPembelajaran,
        media_pembelajaran: formMedia,
        referensi: formReferensi,
        penilaian: formPenilaian
      }
      
      await api.put(`/api/v1/rps/${id}`, parsed)
      toast.success('RPS berhasil diperbarui!')
      setShowEditModal(false)
      loadData()
    } catch (e: any) {
      toast.error(formatApiError(e, 'Gagal memperbarui RPS'))
    }
  }

  async function handleAutoFix() {
    if (!rps || !rps.obe_validation_result) return
    setFixing(true)
    try {
      const feedbackList: string[] = []
      const validationResult = rps.obe_validation_result
      if (validationResult.issues) {
        validationResult.issues.forEach((i: any) => {
          feedbackList.push(`Pada bagian ${i.bagian}: ${i.deskripsi}. Saran: ${i.saran || ''}`)
        })
      }
      if (validationResult.suggestions) {
        validationResult.suggestions.forEach((s: any) => {
          feedbackList.push(`Pada bagian ${s.bagian}: ${s.rekomendasi}`)
        })
      }
      
      const feedback = feedbackList.join('\n')
      
      toast.loading('AI sedang menganalisis & memperbaiki RPS...', { id: 'autofix' })
      const reviewRes = await api.post('/api/v1/generate/review', {
        rps_data: {
          identitas: rps.identitas,
          cpmk: rps.cpmk,
          sub_cpmk: rps.sub_cpmk,
          rencana_pembelajaran: rps.rencana_pembelajaran,
          metode_pembelajaran: rps.metode_pembelajaran,
          media_pembelajaran: rps.media_pembelajaran,
          penilaian: rps.penilaian,
          referensi: rps.referensi,
        },
        feedback: feedback
      })
      
      const improvedData = reviewRes.data.data

      // Normalize dosen_pengampu: AI may return strings instead of {nama, nidn} dicts
      if (improvedData?.identitas?.dosen_pengampu) {
        improvedData.identitas.dosen_pengampu = improvedData.identitas.dosen_pengampu.map(
          (d: any) => typeof d === 'string' ? { nama: d, nidn: '' } : d
        )
      }
      
      await api.put(`/api/v1/rps/${id}`, improvedData)
      toast.success('RPS berhasil diperbaiki secara otomatis oleh AI!', { id: 'autofix' })
      
      handleValidate()
    } catch (e: any) {
      toast.error(formatApiError(e, 'Gagal memperbaiki RPS'), { id: 'autofix' })
    } finally {
      setFixing(false)
    }
  }

  async function handleExport(format: string) {
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
        toast.success(`Export ${format.toUpperCase()} berhasil`)
      }
    } catch (e) {
      toast.error('Gagal export')
    }
  }

  async function handleDelete() {
    if (!confirm('Apakah Anda yakin ingin menghapus RPS ini secara permanen?')) return
    try {
      await api.delete(`/api/v1/rps/${id}`)
      toast.success('RPS berhasil dihapus')
      navigate('/rps')
    } catch {
      toast.error('Gagal menghapus RPS')
    }
  }

  if (loading || !rps) return <div className="text-center py-12 text-gray-400">Memuat...</div>

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      {/* Header — two rows so buttons never overflow */}
      <div className="space-y-2">
        {/* Row 1: back + primary actions */}
        <div className="flex items-center justify-between">
          <Link to="/rps" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-macos-blue transition-colors">
            <ArrowLeft className="w-4 h-4" /> Kembali
          </Link>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {rps.status === 'draft' && isAdmin && (
              <button
                onClick={() => handleUpdateStatus('review')}
                disabled={updatingStatus}
                className="macos-button flex items-center gap-1 bg-yellow-500 hover:bg-yellow-600 text-white text-xs px-3 py-1.5 rounded-apple-md font-medium"
              >
                Ajukan Review
              </button>
            )}
            {(rps.status === 'draft' || rps.status === 'review') && isAdmin && (
              <button
                onClick={() => handleUpdateStatus('approved')}
                disabled={updatingStatus}
                className="macos-button flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white text-xs px-3 py-1.5 rounded-apple-md font-medium"
              >
                Setujui (Approve)
              </button>
            )}
            {rps.status === 'approved' && isAdmin && (
              <button
                onClick={() => handleUpdateStatus('published')}
                disabled={updatingStatus}
                className="macos-button flex items-center gap-1 bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-1.5 rounded-apple-md font-medium"
              >
                Publikasikan
              </button>
            )}
            {rps.status === 'draft' && isAdmin && (
              <button onClick={openEditModal} className="macos-button flex items-center gap-1.5 text-sm bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-apple-md font-medium">
                <Sparkles className="w-4 h-4" /> Edit RPS
              </button>
            )}
          </div>
        </div>
        {/* Row 2: secondary actions */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button onClick={handleValidate} disabled={validating} className="macos-button-ghost flex items-center gap-1.5 text-sm">
            <CheckSquare className="w-4 h-4" /> {validating ? 'Memvalidasi...' : 'Validasi OBE'}
          </button>
          <button onClick={() => handleExport('pdf')} className="macos-button-ghost flex items-center gap-1.5 text-sm">
            <Download className="w-4 h-4" /> PDF
          </button>
          <button onClick={() => handleExport('docx')} className="macos-button-ghost flex items-center gap-1.5 text-sm">
            <FileText className="w-4 h-4" /> DOCX
          </button>
          {isAdmin && (
            <button onClick={handleDelete} className="macos-button-ghost flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 hover:bg-red-50">
              <Trash2 className="w-4 h-4" /> Hapus
            </button>
          )}
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

      {/* OBE Validation Result Card */}
      {rps.obe_validated && rps.obe_validation_result && (
        <div className="macos-card p-5 space-y-4 border border-blue-100 bg-blue-50/10">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-macos-blue" />
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Hasil Validasi Kurikulum OBE</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Analisis keselarasan konstruktif kurikulum oleh AI.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-bold px-3 py-1.5 rounded-apple-lg ${
                rps.obe_score >= 75 ? 'bg-green-50 text-green-600' : rps.obe_score >= 50 ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-600'
              }`}>
                Skor: {rps.obe_score}/100
              </span>
              {rps.status === 'draft' && isAdmin && (
                <button
                  onClick={handleAutoFix}
                  disabled={fixing}
                  className="macos-button flex items-center gap-1.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-xs px-3 py-1.5 rounded-apple-md font-medium"
                >
                  {fixing ? (
                    <>Memperbaiki...</>
                  ) : (
                    <><Sparkles className="w-3.5 h-3.5" /> Perbaiki dengan AI</>
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Issues */}
            {rps.obe_validation_result.issues?.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-700">Masalah / Kesenjangan ({rps.obe_validation_result.issues?.length || 0})</h4>
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {rps.obe_validation_result.issues?.map((issue: any, idx: number) => (
                    <div key={idx} className={`p-2.5 rounded-apple-md text-xs space-y-1 ${
                      issue.severity === 'high' ? 'bg-red-50/70 text-red-700' : 'bg-yellow-50/70 text-yellow-700'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold capitalize">{issue.bagian}</span>
                        <span className={`font-mono text-[9px] uppercase px-1 rounded ${
                          issue.severity === 'high' ? 'bg-red-200 text-red-800' : 'bg-yellow-200 text-yellow-800'
                        }`}>{issue.severity}</span>
                      </div>
                      <p className="text-gray-600">{issue.deskripsi}</p>
                      {issue.saran && <p className="font-medium text-macos-blue mt-1">Saran: {issue.saran}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-700">Masalah / Kesenjangan</h4>
                <p className="text-xs text-gray-400 italic">Tidak ditemukan masalah keselarasan OBE.</p>
              </div>
            )}

            {/* Suggestions */}
            {rps.obe_validation_result.suggestions?.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-700">Saran Perbaikan ({rps.obe_validation_result.suggestions?.length || 0})</h4>
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {rps.obe_validation_result.suggestions?.map((s: any, idx: number) => (
                    <div key={idx} className="p-2.5 bg-blue-50/50 rounded-apple-md text-xs text-blue-700 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold capitalize">{s.bagian}</span>
                        <span className="font-mono text-[9px] uppercase px-1 rounded bg-blue-100 text-blue-800">{s.prioritas}</span>
                      </div>
                      <p className="text-gray-600">{s.rekomendasi}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-700">Saran Perbaikan</h4>
                <p className="text-xs text-gray-400 italic">Tidak ada saran perbaikan tambahan.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Deskripsi & Bahan Kajian */}
      {(rps.deskripsi_mata_kuliah || (rps.bahan_kajian && rps.bahan_kajian.length > 0)) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rps.deskripsi_mata_kuliah && (
            <div className="macos-card p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Deskripsi Singkat Mata Kuliah</h3>
              <p className="text-sm text-gray-600 leading-relaxed text-justify">{rps.deskripsi_mata_kuliah}</p>
            </div>
          )}
          {rps.bahan_kajian && rps.bahan_kajian.length > 0 && (
            <div className="macos-card p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Bahan Kajian / Pokok Bahasan</h3>
              {Array.isArray(rps.bahan_kajian) ? (
                <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                  {rps.bahan_kajian.map((bk: any, idx: number) => (
                    <li key={idx} className="leading-relaxed">{bk}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-600 leading-relaxed text-justify">{rps.bahan_kajian}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* CPMK */}
      {Array.isArray(rps.cpmk) && rps.cpmk.length > 0 && (
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
      {Array.isArray(rps.rencana_pembelajaran) && rps.rencana_pembelajaran.length > 0 && (
        <div className="macos-card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Rencana Kegiatan Pembelajaran (16 Minggu)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50">
                  <th className="text-center py-2 px-3 text-gray-500 font-medium w-[6%]">Minggu</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium w-[22%]">Sub-CPMK</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium w-[22%]">Materi Pembelajaran</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium w-[15%]">Bentuk & Metode</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium w-[12%]">Estimasi Waktu</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium w-[12%]">Pengalaman Belajar</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium w-[12%]">Kriteria Penilaian</th>
                  <th className="text-center py-2 px-3 text-gray-500 font-medium w-[7%]">Bobot (%)</th>
                </tr>
              </thead>
              <tbody>
                {rps.rencana_pembelajaran.map((r: any) => (
                  <tr key={r.minggu_ke} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="py-2.5 px-3 font-mono text-center font-semibold">{r.minggu_ke}</td>
                    <td className="py-2.5 px-3 text-gray-900">
                      <strong>{r.sub_cpmk_kode}</strong>
                      {r.sub_cpmk_deskripsi && <span className="block text-gray-400 font-normal mt-0.5">{r.sub_cpmk_deskripsi}</span>}
                    </td>
                    <td className="py-2.5 px-3 text-gray-700">{r.materi}</td>
                    <td className="py-2.5 px-3 text-gray-600">{typeof r.metode === 'object' ? r.metode?.join(', ') : r.metode}</td>
                    <td className="py-2.5 px-3 text-gray-500 font-mono">{r.estimasi_waktu || r.durasi}</td>
                    <td className="py-2.5 px-3 text-gray-500">{r.pengalaman_belajar || '-'}</td>
                    <td className="py-2.5 px-3 text-gray-500">{r.kriteria_penilaian || '-'}</td>
                    <td className="py-2.5 px-3 text-center font-medium text-gray-900">{r.bobot || 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Penilaian */}
      {Array.isArray(rps.penilaian) && rps.penilaian.length > 0 && (
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
          <div className="macos-card p-6 w-full max-w-4xl h-[90vh] flex flex-col animate-scale-up space-y-4 bg-white/95 shadow-2xl rounded-apple-xl border border-white/20">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Edit Konten RPS</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Ubah isi RPS langsung via form — pilih bagian yang ingin diedit dari tab di bawah.</p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xs"
              >
                Tutup
              </button>
            </div>

            {/* Tab Selector */}
            <div className="flex flex-wrap gap-1 p-0.5 bg-gray-100 rounded-apple-lg self-start">
              {[
                { id: 'identitas', label: '📋 Identitas' },
                { id: 'bahan_kajian', label: '📚 Bahan Kajian' },
                { id: 'cpmk', label: '🎯 CPMK' },
                { id: 'sub_cpmk', label: '📌 Sub-CPMK' },
                { id: 'rencana', label: '🗓️ Kegiatan Minggu' },
                { id: 'media_ref', label: '🔗 Media & Referensi' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`text-[11px] px-2.5 py-1.5 rounded-apple-md font-medium transition-colors ${activeTab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              {activeTab === 'identitas' && (
                <div className="space-y-4 pr-1 text-xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="macos-label">Nama Mata Kuliah</label>
                      <input
                        className="macos-input"
                        value={formIdentitas.nama_mata_kuliah}
                        onChange={(e) => setFormIdentitas({ ...formIdentitas, nama_mata_kuliah: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="macos-label">Kode Mata Kuliah</label>
                      <input
                        className="macos-input"
                        value={formIdentitas.kode_mata_kuliah}
                        onChange={(e) => setFormIdentitas({ ...formIdentitas, kode_mata_kuliah: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="macos-label">Bobot (SKS)</label>
                      <input
                        type="number"
                        className="macos-input"
                        value={formIdentitas.sks}
                        onChange={(e) => setFormIdentitas({ ...formIdentitas, sks: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="macos-label">Semester</label>
                      <input
                        type="number"
                        className="macos-input"
                        value={formIdentitas.semester}
                        onChange={(e) => setFormIdentitas({ ...formIdentitas, semester: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="macos-label">Tanggal Penyusunan</label>
                      <input
                        className="macos-input"
                        value={formIdentitas.tanggal_penyusunan}
                        onChange={(e) => setFormIdentitas({ ...formIdentitas, tanggal_penyusunan: e.target.value })}
                        placeholder="Contoh: 09 Agustus 2022"
                      />
                    </div>
                    <div>
                      <label className="macos-label">Nomor Dokumen</label>
                      <input
                        className="macos-input"
                        value={formIdentitas.no_dokumen}
                        onChange={(e) => setFormIdentitas({ ...formIdentitas, no_dokumen: e.target.value })}
                        placeholder="Contoh: Dok-RPS-01"
                      />
                    </div>
                  </div>
                  <div className="border-t border-gray-100 pt-3">
                    <h4 className="text-xs font-semibold text-gray-900 mb-2">Tanda Tangan Otorisasi</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="macos-label">Nama Koordinator Pengembang RPS</label>
                        <input
                          className="macos-input"
                          value={formIdentitas.koordinator_pengembang_rps}
                          onChange={(e) => setFormIdentitas({ ...formIdentitas, koordinator_pengembang_rps: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="macos-label">Nama Koordinator Rumpun MK (RMK)</label>
                        <input
                          className="macos-input"
                          value={formIdentitas.koordinator_rmk}
                          onChange={(e) => setFormIdentitas({ ...formIdentitas, koordinator_rmk: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="macos-label">Nama Ketua Program Studi (Ka Prodi)</label>
                        <input
                          className="macos-input"
                          value={formIdentitas.ka_prodi}
                          onChange={(e) => setFormIdentitas({ ...formIdentitas, ka_prodi: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'bahan_kajian' && (
                <div className="space-y-3 pr-1 text-xs">
                  <h4 className="text-xs font-semibold text-gray-900 mb-2">Bahan Kajian / Pokok Bahasan</h4>
                  <div className="space-y-2">
                    {formBahanKajian.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          className="macos-input flex-1"
                          value={item}
                          onChange={(e) => {
                            const updated = [...formBahanKajian]
                            updated[idx] = e.target.value
                            setFormBahanKajian(updated)
                          }}
                        />
                        <button
                          onClick={() => {
                            const updated = formBahanKajian.filter((_: any, i: number) => i !== idx)
                            setFormBahanKajian(updated)
                          }}
                          className="text-red-500 hover:text-red-700 font-medium px-2 py-1"
                        >
                          Hapus
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setFormBahanKajian([...formBahanKajian, ''])}
                      className="macos-button-ghost py-1.5 px-3 text-[11px] self-start"
                    >
                      + Tambah Pokok Bahasan
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'cpmk' && (
                <div className="space-y-4 pr-1 text-xs">
                  <h4 className="text-xs font-semibold text-gray-900">Edit Capaian Pembelajaran Mata Kuliah (CPMK)</h4>
                  <div className="space-y-4">
                    {formCPMK.map((item, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 rounded-apple-lg border border-gray-100 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-macos-blue">{item.kode}</span>
                          <span className="text-[10px] text-gray-400">
                            CPL Terkait: {Array.isArray(item.cpl_prodi) ? item.cpl_prodi.join(', ') : item.cpl_prodi || '-'}
                          </span>
                        </div>
                        <div>
                          <label className="macos-label">Deskripsi</label>
                          <textarea
                            className="macos-input py-1.5 h-16 resize-none"
                            value={item.deskripsi || ''}
                            onChange={(e) => {
                              const updated = [...formCPMK]
                              updated[idx] = { ...item, deskripsi: e.target.value }
                              setFormCPMK(updated)
                            }}
                          />
                        </div>
                        <div>
                          <label className="macos-label">Bobot</label>
                          <input
                            type="text"
                            className="macos-input w-24"
                            value={item.bobot || ''}
                            onChange={(e) => {
                              const updated = [...formCPMK]
                              updated[idx] = { ...item, bobot: e.target.value }
                              setFormCPMK(updated)
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'sub_cpmk' && (
                <div className="space-y-4 pr-1 text-xs">
                  <h4 className="text-xs font-semibold text-gray-900">Edit Sub-CPMK</h4>
                  <div className="space-y-4">
                    {formSubCPMK.map((item, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 rounded-apple-lg border border-gray-100 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-purple-600">{item.kode}</span>
                          <span className="text-[10px] text-gray-400">Parent CPMK: {item.cpmk_kode || '-'}</span>
                        </div>
                        <div>
                          <label className="macos-label">Deskripsi</label>
                          <textarea
                            className="macos-input py-1.5 h-16 resize-none"
                            value={item.deskripsi || ''}
                            onChange={(e) => {
                              const updated = [...formSubCPMK]
                              updated[idx] = { ...item, deskripsi: e.target.value }
                              setFormSubCPMK(updated)
                            }}
                          />
                        </div>
                        <div>
                          <label className="macos-label mb-1">Indikator Penilaian</label>
                          <div className="space-y-1.5 pl-2 border-l-2 border-gray-200">
                            {Array.isArray(item.indikator) && item.indikator.map((ind: string, indIdx: number) => (
                              <div key={indIdx} className="flex items-center gap-1.5">
                                <input
                                  className="macos-input py-1 text-[11px]"
                                  value={ind || ''}
                                  onChange={(e) => {
                                    const updatedSub = [...formSubCPMK]
                                    const updatedInd = [...item.indikator]
                                    updatedInd[indIdx] = e.target.value
                                    updatedSub[idx] = { ...item, indikator: updatedInd }
                                    setFormSubCPMK(updatedSub)
                                  }}
                                />
                                <button
                                  onClick={() => {
                                    const updatedSub = [...formSubCPMK]
                                    const updatedInd = item.indikator.filter((_: any, i: number) => i !== indIdx)
                                    updatedSub[idx] = { ...item, indikator: updatedInd }
                                    setFormSubCPMK(updatedSub)
                                  }}
                                  className="text-red-500 hover:text-red-700 text-[10px] font-medium"
                                >
                                  Hapus
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => {
                                  const updatedSub = [...formSubCPMK]
                                  const currentInd = Array.isArray(item.indikator) ? item.indikator : []
                                  updatedSub[idx] = { ...item, indikator: [...currentInd, ''] }
                                  setFormSubCPMK(updatedSub)
                              }}
                              className="text-[10px] text-macos-blue hover:underline font-medium"
                            >
                              + Tambah Indikator
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'rencana' && (
                <div className="space-y-4 pr-1 text-xs">
                  <h4 className="text-xs font-semibold text-gray-900 mb-2">Rencana Pembelajaran Mingguan (Minggu 1-16)</h4>
                  <div className="overflow-x-auto border border-gray-200 rounded-apple-lg">
                    <table className="w-full text-[11px] border-collapse bg-white">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="p-2 border-r border-gray-200 w-12 text-center">Minggu</th>
                          <th className="p-2 border-r border-gray-200 w-28 text-center">Sub-CPMK</th>
                          <th className="p-2 border-r border-gray-200 w-48 text-center">Materi Pembelajaran</th>
                          <th className="p-2 border-r border-gray-200 w-36 text-center">Bentuk & Metode</th>
                          <th className="p-2 border-r border-gray-200 w-28 text-center">Estimasi Waktu</th>
                          <th className="p-2 border-r border-gray-200 w-40 text-center">Pengalaman Belajar</th>
                          <th className="p-2 border-r border-gray-200 w-36 text-center">Kriteria Penilaian</th>
                          <th className="p-2 w-16 text-center">Bobot</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formRencanaPembelajaran.map((row, idx) => (
                          <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="p-1.5 border-r border-gray-200 text-center font-bold">{row.minggu_ke}</td>
                            <td className="p-1.5 border-r border-gray-200">
                              <input
                                className="w-full bg-transparent border-0 focus:ring-0 p-0 text-[11px] font-semibold text-macos-blue"
                                value={row.sub_cpmk_kode || ''}
                                onChange={(e) => {
                                  const updated = [...formRencanaPembelajaran]
                                  updated[idx] = { ...row, sub_cpmk_kode: e.target.value }
                                  setFormRencanaPembelajaran(updated)
                                }}
                              />
                            </td>
                            <td className="p-1.5 border-r border-gray-200">
                              <textarea
                                className="w-full bg-transparent border-0 focus:ring-0 p-0 text-[11px] h-12 resize-none"
                                value={row.materi || ''}
                                onChange={(e) => {
                                  const updated = [...formRencanaPembelajaran]
                                  updated[idx] = { ...row, materi: e.target.value }
                                  setFormRencanaPembelajaran(updated)
                                }}
                              />
                            </td>
                            <td className="p-1.5 border-r border-gray-200">
                              <input
                                className="w-full bg-transparent border-0 focus:ring-0 p-0 text-[11px]"
                                value={row.metode || ''}
                                onChange={(e) => {
                                  const updated = [...formRencanaPembelajaran]
                                  updated[idx] = { ...row, metode: e.target.value }
                                  setFormRencanaPembelajaran(updated)
                                }}
                              />
                            </td>
                            <td className="p-1.5 border-r border-gray-200">
                              <input
                                className="w-full bg-transparent border-0 focus:ring-0 p-0 text-[11px]"
                                value={row.estimasi_waktu || ''}
                                onChange={(e) => {
                                  const updated = [...formRencanaPembelajaran]
                                  updated[idx] = { ...row, estimasi_waktu: e.target.value }
                                  setFormRencanaPembelajaran(updated)
                                }}
                              />
                            </td>
                            <td className="p-1.5 border-r border-gray-200">
                              <textarea
                                className="w-full bg-transparent border-0 focus:ring-0 p-0 text-[11px] h-12 resize-none"
                                value={row.pengalaman_belajar || ''}
                                onChange={(e) => {
                                  const updated = [...formRencanaPembelajaran]
                                  updated[idx] = { ...row, pengalaman_belajar: e.target.value }
                                  setFormRencanaPembelajaran(updated)
                                }}
                              />
                            </td>
                            <td className="p-1.5 border-r border-gray-200">
                              <input
                                className="w-full bg-transparent border-0 focus:ring-0 p-0 text-[11px]"
                                value={row.kriteria_penilaian || ''}
                                onChange={(e) => {
                                  const updated = [...formRencanaPembelajaran]
                                  updated[idx] = { ...row, kriteria_penilaian: e.target.value }
                                  setFormRencanaPembelajaran(updated)
                                }}
                              />
                            </td>
                            <td className="p-1.5 text-center">
                              <input
                                className="w-full bg-transparent border-0 focus:ring-0 p-0 text-[11px] text-center"
                                value={row.bobot || ''}
                                onChange={(e) => {
                                  const updated = [...formRencanaPembelajaran]
                                  updated[idx] = { ...row, bobot: e.target.value }
                                  setFormRencanaPembelajaran(updated)
                                }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'media_ref' && (
                <div className="space-y-4 pr-1 text-xs">
                  {/* Media Pembelajaran */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-gray-900">Media Pembelajaran</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="macos-label">Perangkat Lunak (Software)</label>
                        {formMedia.software?.map((item: string, idx: number) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            <input
                              className="macos-input py-1 text-[11px]"
                              value={item}
                              onChange={(e) => {
                                const updatedSoft = [...formMedia.software]
                                updatedSoft[idx] = e.target.value
                                setFormMedia({ ...formMedia, software: updatedSoft })
                              }}
                            />
                            <button
                              onClick={() => {
                                const updatedSoft = formMedia.software.filter((_: any, i: number) => i !== idx)
                                setFormMedia({ ...formMedia, software: updatedSoft })
                              }}
                              className="text-red-500 hover:text-red-700 text-[10px] font-medium"
                            >
                              Hapus
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => setFormMedia({ ...formMedia, software: [...(formMedia.software || []), ''] })}
                          className="text-[10px] text-macos-blue hover:underline font-medium"
                        >
                          + Tambah Software
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <label className="macos-label">Perangkat Keras (Hardware)</label>
                        {formMedia.hardware?.map((item: string, idx: number) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            <input
                              className="macos-input py-1 text-[11px]"
                              value={item}
                              onChange={(e) => {
                                const updatedHard = [...formMedia.hardware]
                                updatedHard[idx] = e.target.value
                                setFormMedia({ ...formMedia, hardware: updatedHard })
                              }}
                            />
                            <button
                              onClick={() => {
                                const updatedHard = formMedia.hardware.filter((_: any, i: number) => i !== idx)
                                setFormMedia({ ...formMedia, hardware: updatedHard })
                              }}
                              className="text-red-500 hover:text-red-700 text-[10px] font-medium"
                            >
                              Hapus
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => setFormMedia({ ...formMedia, hardware: [...(formMedia.hardware || []), ''] })}
                          className="text-[10px] text-macos-blue hover:underline font-medium"
                        >
                          + Tambah Hardware
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Referensi */}
                  <div className="space-y-2 border-t border-gray-100 pt-3">
                    <h4 className="text-xs font-semibold text-gray-900">Referensi / Rujukan</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="macos-label">Referensi Utama</label>
                        {formReferensi.utama?.map((item: string, idx: number) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            <input
                              className="macos-input py-1 text-[11px]"
                              value={item}
                              onChange={(e) => {
                                const updatedUtama = [...formReferensi.utama]
                                updatedUtama[idx] = e.target.value
                                setFormReferensi({ ...formReferensi, utama: updatedUtama })
                              }}
                            />
                            <button
                              onClick={() => {
                                const updatedUtama = formReferensi.utama.filter((_: any, i: number) => i !== idx)
                                setFormReferensi({ ...formReferensi, utama: updatedUtama })
                              }}
                              className="text-red-500 hover:text-red-700 text-[10px] font-medium"
                            >
                              Hapus
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => setFormReferensi({ ...formReferensi, utama: [...(formReferensi.utama || []), ''] })}
                          className="text-[10px] text-macos-blue hover:underline font-medium"
                        >
                          + Tambah Referensi Utama
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <label className="macos-label">Referensi Pendukung</label>
                        {formReferensi.pendukung?.map((item: string, idx: number) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            <input
                              className="macos-input py-1 text-[11px]"
                              value={item}
                              onChange={(e) => {
                                const updatedPendukung = [...formReferensi.pendukung]
                                updatedPendukung[idx] = e.target.value
                                setFormReferensi({ ...formReferensi, pendukung: updatedPendukung })
                              }}
                            />
                            <button
                              onClick={() => {
                                const updatedPendukung = formReferensi.pendukung.filter((_: any, i: number) => i !== idx)
                                setFormReferensi({ ...formReferensi, pendukung: updatedPendukung })
                              }}
                              className="text-red-500 hover:text-red-700 text-[10px] font-medium"
                            >
                              Hapus
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => setFormReferensi({ ...formReferensi, pendukung: [...(formReferensi.pendukung || []), ''] })}
                          className="text-[10px] text-macos-blue hover:underline font-medium"
                        >
                          + Tambah Referensi Pendukung
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Penilaian */}
                  <div className="space-y-2 border-t border-gray-100 pt-3">
                    <h4 className="text-xs font-semibold text-gray-900">Komponen Penilaian & Bobot</h4>
                    <div className="space-y-2">
                      {formPenilaian.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            className="macos-input flex-1 py-1 text-[11px]"
                            value={item.komponen || ''}
                            onChange={(e) => {
                              const updated = [...formPenilaian]
                              updated[idx] = { ...item, komponen: e.target.value }
                              setFormPenilaian(updated)
                            }}
                            placeholder="Contoh: UTS / Tugas Mandiri"
                          />
                          <input
                            type="text"
                            className="macos-input w-20 py-1 text-[11px] text-center"
                            value={item.bobot || ''}
                            onChange={(e) => {
                              const updated = [...formPenilaian]
                              updated[idx] = { ...item, bobot: e.target.value }
                              setFormPenilaian(updated)
                            }}
                            placeholder="Contoh: 0.3"
                          />
                          <button
                            onClick={() => {
                              const updated = formPenilaian.filter((_, i) => i !== idx)
                              setFormPenilaian(updated)
                            }}
                            className="text-red-500 hover:text-red-700 text-[10px] font-medium px-1"
                          >
                            Hapus
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => setFormPenilaian([...formPenilaian, { komponen: '', bobot: 0.1, jenis: 'tugas' }])}
                        className="text-[10px] text-macos-blue hover:underline font-medium"
                      >
                        + Tambah Komponen Penilaian
                      </button>
                    </div>
                  </div>
                </div>
              )}


            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
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