import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, FileText, CheckCircle, AlertCircle, Download, Trash2 } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'

interface ProdiOption {
  id: number
  kode: string
  nama: string
}

export default function BulkImport() {
  const navigate = useNavigate()
  const [prodiList, setProdiList] = useState<ProdiOption[]>([])
  const [prodiId, setProdiId] = useState('')
  const [textData, setTextData] = useState('')
  const [preview, setPreview] = useState<any[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    api.get('/api/v1/prodi/?size=50').then(r => setProdiList(r.data.items || []))
  }, [])

  const TEMPLATE = `KODE | NAMA | SKS | SKS_TEORI | SKS_PRAKTIK | SEMESTER | DESKRIPSI
TI101 | Algoritma Pemrograman | 3 | 2 | 1 | 1 | Dasar-dasar algoritma dan pemrograman
TI102 | Struktur Data | 3 | 2 | 1 | 2 | Struktur data linear dan non-linear
TI103 | Basis Data | 3 | 2 | 1 | 3 | Konsep dan implementasi basis data
TI104 | Jaringan Komputer | 3 | 2 | 1 | 3 | Dasar jaringan dan komunikasi data`

  function parseText(text: string) {
    const lines = text.trim().split('\n').filter(l => l.trim())
    if (lines.length === 0) {
      setPreview([])
      return
    }

    const firstLine = lines[0].toLowerCase()
    const hasHeader = firstLine.includes('kode') || firstLine.includes('nama') || firstLine.includes('sks')
    const dataLines = hasHeader ? lines.slice(1) : lines

    let colIndices: Record<string, number> = {}
    if (hasHeader) {
      const headerParts = lines[0].split('|').map(p => p.trim().toLowerCase())
      headerParts.forEach((part, index) => {
        if (part.includes('kode')) colIndices['kode'] = index
        else if (part.includes('nama_inggris') || part.includes('inggris')) colIndices['nama_inggris'] = index
        else if (part.includes('nama')) colIndices['nama'] = index
        else if (part.includes('sks_teori') || part.includes('teori')) colIndices['sks_teori'] = index
        else if (part.includes('sks_praktik') || part.includes('praktik')) colIndices['sks_praktik'] = index
        else if (part.includes('sks')) colIndices['sks'] = index
        else if (part.includes('semester') || part.includes('sem')) colIndices['semester'] = index
        else if (part.includes('deskripsi') || part.includes('desc')) colIndices['deskripsi'] = index
      })
    }

    const parsed = dataLines.map((line, i) => {
      const parts = line.split('|').map(p => p.trim())
      
      let kode = ''
      let nama = ''
      let sks: number | null = null
      let sks_teori: number | null = null
      let sks_praktik: number | null = null
      let semester: number | null = null
      let deskripsi = ''

      if (hasHeader) {
        if (colIndices['kode'] !== undefined) kode = parts[colIndices['kode']] || ''
        if (colIndices['nama'] !== undefined) nama = parts[colIndices['nama']] || ''
        if (colIndices['sks'] !== undefined) {
          const val = parseInt(parts[colIndices['sks']])
          if (!isNaN(val)) sks = val
        }
        if (colIndices['sks_teori'] !== undefined) {
          const val = parseInt(parts[colIndices['sks_teori']])
          if (!isNaN(val)) sks_teori = val
        }
        if (colIndices['sks_praktik'] !== undefined) {
          const val = parseInt(parts[colIndices['sks_praktik']])
          if (!isNaN(val)) sks_praktik = val
        }
        if (colIndices['semester'] !== undefined) {
          const val = parseInt(parts[colIndices['semester']])
          if (!isNaN(val)) semester = val
        }
        if (colIndices['deskripsi'] !== undefined) {
          deskripsi = parts[colIndices['deskripsi']] || ''
        }
      } else {
        // Fallback positional parsing: KODE | NAMA | SKS | SKS_TEORI | SKS_PRAKTIK | SEMESTER | DESKRIPSI
        kode = parts[0] || ''
        nama = parts[1] || ''
        
        const sksVal = parseInt(parts[2])
        if (!isNaN(sksVal)) sks = sksVal
        
        const teoriVal = parseInt(parts[3])
        if (!isNaN(teoriVal)) sks_teori = teoriVal
        
        const praktikVal = parseInt(parts[4])
        if (!isNaN(praktikVal)) sks_praktik = praktikVal
        
        const semVal = parseInt(parts[5])
        if (!isNaN(semVal)) semester = semVal
        
        deskripsi = parts[6] || ''
      }

      // Smart calculations / Fallbacks for SKS
      if (sks === null) sks = 3
      
      if (sks_teori === null && sks_praktik === null) {
        // Both missing: if SKS is 3, default to 2 theory, 1 practice. Otherwise, default to sks theory, 0 practice.
        if (sks === 3) {
          sks_teori = 2
          sks_praktik = 1
        } else {
          sks_teori = sks
          sks_praktik = 0
        }
      } else if (sks_teori !== null && sks_praktik === null) {
        // sks_teori provided, sks_praktik missing
        sks_praktik = Math.max(0, sks - sks_teori)
      } else if (sks_praktik !== null && sks_teori === null) {
        // sks_praktik provided, sks_teori missing
        sks_teori = Math.max(0, sks - sks_praktik)
      }

      if (semester === null) semester = 1

      return {
        kode,
        nama,
        sks,
        sks_teori,
        sks_praktik,
        semester,
        deskripsi,
        _line: i + (hasHeader ? 2 : 1),
      }
    })
    setPreview(parsed)
  }

  function handleTextChange(val: string) {
    setTextData(val)
    if (val.trim()) parseText(val)
    else setPreview([])
  }

  async function handleSubmit() {
    if (!prodiId || preview.length === 0) return
    setSubmitting(true)
    try {
      const payload = preview.map(({ _line, ...item }) => ({ ...item, prodi_id: parseInt(prodiId) }))
      const res = await api.post('/api/v1/mata-kuliah/bulk', payload)
      setResult(res.data)
      if (res.data.errors === 0) {
        toast.success(`${res.data.created} mata kuliah berhasil ditambahkan!`)
      } else {
        toast.success(`${res.data.created} berhasil, ${res.data.errors} gagal`)
      }
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Gagal import')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/mata-kuliah" className="p-2 rounded-apple-lg hover:bg-black/5">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Import Mata Kuliah</h1>
            <p className="text-sm text-gray-500 mt-0.5">Tambah banyak mata kuliah sekaligus</p>
          </div>
        </div>
      </div>

      {/* Pilih Prodi */}
      <div className="macos-card p-5">
        <label className="macos-label">Program Studi</label>
        <select
          className="macos-input"
          value={prodiId}
          onChange={(e) => setProdiId(e.target.value)}
        >
          <option value="">Pilih prodi...</option>
          {prodiList.map(p => (
            <option key={p.id} value={p.id}>{p.nama} ({p.kode})</option>
          ))}
        </select>
      </div>

      {/* Format Input */}
      <div className="macos-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Data Mata Kuliah</h3>
          <button
            onClick={() => { setTextData(TEMPLATE); parseText(TEMPLATE) }}
            className="macos-button-ghost text-xs flex items-center gap-1.5 px-3 py-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Muat Contoh
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Format: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">KODE | NAMA | SKS | SKS_TEORI | SKS_PRAKTIK | SEMESTER | DESKRIPSI</code>
          <br />Pisahkan dengan pipe (<code className="bg-gray-100 px-1.5 py-0.5 rounded">|</code>), 1 baris = 1 mata kuliah. 
          SKS Praktik tidak wajib (otomatis dihitung dari SKS - SKS Teori jika tidak diisi).
        </p>
        <textarea
          className="macos-input font-mono text-xs min-h-[200px] resize-y"
          value={textData}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="TI101 | Algoritma | 3 | 2 | 1 | 1 | Deskripsi&#10;TI102 | Struktur Data | 3 | 2 | 1 | 2 | Deskripsi"
        />
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div className="macos-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">
              Preview ({preview.length} mata kuliah)
            </h3>
            <span className="text-xs text-gray-400">
              {preview.filter(p => p.kode && p.nama).length} valid
            </span>
          </div>
          <div className="overflow-x-auto max-h-60 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="text-left py-2 pr-3">#</th>
                  <th className="text-left py-2 pr-3">Kode</th>
                  <th className="text-left py-2 pr-3">Nama</th>
                  <th className="text-left py-2 pr-3">SKS (Teori/Prak)</th>
                  <th className="text-left py-2 pr-3">Sem</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((item, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="py-2 pr-3 text-gray-400">{item._line}</td>
                    <td className="py-2 pr-3 font-mono text-gray-700">{item.kode || <span className="text-red-400">?</span>}</td>
                    <td className="py-2 pr-3 text-gray-700">{item.nama || <span className="text-red-400">?</span>}</td>
                    <td className="py-2 pr-3">{item.sks} (T:{item.sks_teori} P:{item.sks_praktik})</td>
                    <td className="py-2 pr-3">{item.semester}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="macos-card p-5">
          <div className="flex items-center gap-3 mb-3">
            {result.errors === 0 ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-yellow-500" />
            )}
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Hasil Import</h3>
              <p className="text-xs text-gray-500">
                {result.created} berhasil · {result.errors} gagal · {result.total} total
              </p>
            </div>
          </div>
          {result.error_detail?.length > 0 && (
            <div className="space-y-1 mt-2">
              {result.error_detail.map((e: any, i: number) => (
                <div key={i} className="text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-apple-lg">
                  {e.kode} {e.nama}: {e.error}
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => navigate('/mata-kuliah')}
            className="macos-button mt-3 w-full"
          >
            Lihat Daftar Mata Kuliah
          </button>
        </div>
      )}

      {/* Submit */}
      {preview.length > 0 && !result && (
        <button
          onClick={handleSubmit}
          disabled={submitting || !prodiId}
          className="macos-button w-full py-3 flex items-center justify-center gap-2"
        >
          <Upload className="w-4 h-4" />
          {submitting ? 'Mengimport...' : `Import ${preview.length} Mata Kuliah`}
        </button>
      )}
    </div>
  )
}