import { useEffect, useRef, useState } from 'react'
import { Users, UserPlus, Trash2, Edit2, X, Key, Eye, EyeOff, Shield, Upload, CheckSquare, Square, AlertCircle } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'

interface User {
  id: number
  username: string
  nama: string
  email?: string
  nidn?: string
  role: string
  prodi_id?: number
  is_active: boolean
}

interface Prodi {
  id: number
  nama: string
  kode: string
}

const ROLES = [
  { value: 'dosen',       label: 'Dosen',        color: 'bg-blue-100 text-blue-700' },
  { value: 'ketua_prodi', label: 'Ketua Prodi',  color: 'bg-indigo-100 text-indigo-700' },
  { value: 'gmk',         label: 'GMK / Fakultas', color: 'bg-orange-100 text-orange-700' },
  { value: 'prodi',       label: 'Prodi (legacy)', color: 'bg-sky-100 text-sky-700' },
  { value: 'admin',       label: 'Admin',         color: 'bg-purple-100 text-purple-700' },
]

function getRoleDisplay(role: string) {
  return ROLES.find(r => r.value === role) ?? { label: role, color: 'bg-gray-100 text-gray-600' }
}

function formatApiError(e: any, fallback: string): string {
  if (e?.response?.data?.detail) {
    const d = e.response.data.detail
    if (typeof d === 'string') return d
    if (Array.isArray(d)) return d.map((x: any) => `${x.loc?.join('.') || 'field'}: ${x.msg}`).join(', ')
  }
  return e?.message || fallback
}

// ─── CSV parser ──────────────────────────────────────────────────────────────
// Columns: username; password; nama; nidn; email; role; prodi_id
function parseCsvText(raw: string, prodiList: Prodi[], defaultRole: string): { rows: any[]; warnings: string[] } {
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
  const rows: any[] = []
  const warnings: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(';').map(p => p.trim())
    if (parts.length < 3) { warnings.push(`Baris ${i + 1}: terlalu sedikit kolom, dilewati`); continue }
    const [username, password, nama, nidn, email, roleRaw, prodiIdRaw] = parts
    if (!username || !password || !nama) { warnings.push(`Baris ${i + 1}: username/password/nama wajib diisi`); continue }

    // Role matching
    let role = (roleRaw || defaultRole).toLowerCase().replace(/\s+/g, '_')
    const validRoles = ROLES.map(r => r.value)
    if (!validRoles.includes(role)) role = defaultRole

    // Prodi matching by name or id
    let prodi_id: number | undefined = undefined
    if (prodiIdRaw) {
      const asNum = parseInt(prodiIdRaw)
      if (!isNaN(asNum)) {
        prodi_id = asNum
      } else {
        // Try match by nama/kode
        const found = prodiList.find(p =>
          p.nama.toLowerCase().includes(prodiIdRaw.toLowerCase()) ||
          p.kode.toLowerCase() === prodiIdRaw.toLowerCase()
        )
        prodi_id = found?.id
      }
    }

    rows.push({ username, password, nama, nidn: nidn || undefined, email: email || undefined, role, prodi_id })
  }
  return { rows, warnings }
}

export default function UserManagement() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [prodiList, setProdiList] = useState<Prodi[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const [passwordModal, setPasswordModal] = useState<{ userId: number; username: string } | null>(null)
  const [pwForm, setPwForm] = useState({ newPassword: '', confirmPassword: '' })
  const [showPw, setShowPw] = useState(false)
  const [savingPw, setSavingPw] = useState(false)

  const [showSelfPwModal, setShowSelfPwModal] = useState(false)
  const [selfPwForm, setSelfPwForm] = useState({ newPassword: '', confirmPassword: '' })
  const [showSelfPw, setShowSelfPw] = useState(false)

  const [form, setForm] = useState({ username: '', password: '', nama: '', nidn: '', email: '', role: 'dosen', prodi_id: '' })

  // Bulk import state
  const [showBulk, setShowBulk] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [bulkDefaultRole, setBulkDefaultRole] = useState('dosen')
  const [bulkPreview, setBulkPreview] = useState<any[]>([])
  const [bulkWarnings, setBulkWarnings] = useState<string[]>([])
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [bulkResult, setBulkResult] = useState<any>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Bulk delete state
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [usersRes, prodiRes] = await Promise.all([
        api.get('/api/v1/auth/users'),
        api.get('/api/v1/prodi/?size=100'),
      ])
      setUsers(usersRes.data)
      setProdiList(prodiRes.data.items || [])
    } catch { toast.error('Gagal memuat data') }
    finally { setLoading(false) }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    try {
      const payload = { ...form, prodi_id: form.prodi_id ? parseInt(form.prodi_id) : undefined }
      await api.post('/api/v1/auth/users', payload)
      toast.success('User berhasil dibuat')
      closeForm()
      loadData()
    } catch (err: any) { toast.error(formatApiError(err, 'Gagal membuat user')) }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    try {
      await api.put(`/api/v1/auth/users/${editingId}`, {
        nama: form.nama, nidn: form.nidn, email: form.email, role: form.role,
        prodi_id: form.prodi_id ? parseInt(form.prodi_id) : null,
      })
      toast.success('User berhasil diperbarui')
      closeForm()
      loadData()
    } catch (err: any) { toast.error(formatApiError(err, 'Gagal memperbarui user')) }
  }

  async function handleDelete(id: number) {
    if (!confirm('Yakin hapus user ini? Tindakan ini tidak bisa dibatalkan.')) return
    try {
      await api.delete(`/api/v1/auth/users/${id}`)
      toast.success('User dihapus')
      loadData()
    } catch (err: any) { toast.error(formatApiError(err, 'Gagal menghapus')) }
  }

  async function toggleActive(user: User) {
    try {
      await api.put(`/api/v1/auth/users/${user.id}`, { is_active: !user.is_active })
      toast.success(`User ${user.is_active ? 'dinonaktifkan' : 'diaktifkan'}`)
      loadData()
    } catch { toast.error('Gagal update status') }
  }

  async function handleChangePassword() {
    if (!passwordModal) return
    if (pwForm.newPassword.length < 4) { toast.error('Password minimal 4 karakter'); return }
    if (pwForm.newPassword !== pwForm.confirmPassword) { toast.error('Konfirmasi password tidak cocok!'); return }
    setSavingPw(true)
    try {
      await api.put(`/api/v1/auth/users/${passwordModal.userId}/password`, { new_password: pwForm.newPassword })
      toast.success(`Password ${passwordModal.username} berhasil diubah`)
      setPasswordModal(null)
      setPwForm({ newPassword: '', confirmPassword: '' })
    } catch (err: any) { toast.error(formatApiError(err, 'Gagal mengubah password')) }
    finally { setSavingPw(false) }
  }

  async function handleSelfChangePassword() {
    if (selfPwForm.newPassword.length < 4) { toast.error('Password minimal 4 karakter'); return }
    if (selfPwForm.newPassword !== selfPwForm.confirmPassword) { toast.error('Konfirmasi password tidak cocok!'); return }
    try {
      await api.post('/api/v1/auth/me/change-password', { new_password: selfPwForm.newPassword })
      toast.success('Password berhasil diubah!')
      setShowSelfPwModal(false)
      setSelfPwForm({ newPassword: '', confirmPassword: '' })
    } catch (err: any) { toast.error(formatApiError(err, 'Gagal mengubah password')) }
  }

  function openEditForm(user: User) {
    setEditingId(user.id)
    setForm({ username: user.username, password: '', nama: user.nama, nidn: user.nidn || '', email: user.email || '', role: user.role, prodi_id: user.prodi_id?.toString() || '' })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm({ username: '', password: '', nama: '', nidn: '', email: '', role: 'dosen', prodi_id: '' })
  }

  // ─── Bulk delete helpers ────────────────────────────────────────────────────
  function toggleSelect(id: number) {
    const next = new Set(selectedIds)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelectedIds(next)
  }

  function toggleSelectAll() {
    setSelectedIds(selectedIds.size === users.length ? new Set() : new Set(users.map(u => u.id)))
  }

  function exitBulkMode() { setBulkMode(false); setSelectedIds(new Set()) }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return
    if (!confirm(`Hapus ${selectedIds.size} user terpilih? Tindakan ini tidak bisa dibatalkan.`)) return
    setBulkDeleting(true)
    try {
      // Delete one-by-one (no bulk endpoint needed – user count is always small)
      let deleted = 0
      for (const id of selectedIds) {
        if ((me as any)?.id === id) continue
        await api.delete(`/api/v1/auth/users/${id}`)
        deleted++
      }
      toast.success(`${deleted} user berhasil dihapus`)
      exitBulkMode()
      loadData()
    } catch (err: any) { toast.error(formatApiError(err, 'Gagal menghapus')) }
    finally { setBulkDeleting(false) }
  }

  // ─── Bulk import helpers ────────────────────────────────────────────────────
  function handleBulkTextChange(text: string) {
    setBulkText(text)
    setBulkResult(null)
    const { rows, warnings } = parseCsvText(text, prodiList, bulkDefaultRole)
    setBulkPreview(rows)
    setBulkWarnings(warnings)
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => handleBulkTextChange(ev.target?.result as string)
    reader.readAsText(file)
  }

  async function handleBulkSubmit() {
    if (bulkPreview.length === 0) { toast.error('Tidak ada data valid untuk diimport'); return }
    setBulkSubmitting(true)
    setBulkResult(null)
    try {
      const res = await api.post('/api/v1/auth/users/bulk', bulkPreview)
      setBulkResult(res.data)
      if (res.data.created > 0) {
        toast.success(`${res.data.created} user berhasil dibuat`)
        loadData()
      }
      if (res.data.errors > 0) toast.error(`${res.data.errors} baris gagal`)
    } catch (err: any) { toast.error(formatApiError(err, 'Gagal import')) }
    finally { setBulkSubmitting(false) }
  }

  function closeBulkModal() {
    setShowBulk(false)
    setBulkText('')
    setBulkPreview([])
    setBulkWarnings([])
    setBulkResult(null)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Manajemen User</h1>
          <p className="text-sm text-gray-500 mt-1">Kelola akun dosen, ketua prodi, GMK, dan admin</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="macos-button-ghost flex items-center gap-1.5 text-sm text-orange-600 hover:bg-orange-50" onClick={() => setShowSelfPwModal(true)}>
            <Shield className="w-4 h-4" /> Ganti Password Saya
          </button>
          {bulkMode ? (
            <button onClick={exitBulkMode} className="macos-button-ghost flex items-center gap-1.5 text-sm">
              <X className="w-4 h-4" /> Batal Pilih
            </button>
          ) : (
            <>
              <button onClick={() => setBulkMode(true)} className="macos-button-ghost flex items-center gap-1.5 text-sm">
                <CheckSquare className="w-4 h-4" /> Pilih Massal
              </button>
              <button className="macos-button-ghost flex items-center gap-1.5 text-sm" onClick={() => setShowBulk(true)}>
                <Upload className="w-4 h-4" /> Import Bulk
              </button>
              <button className="macos-button flex items-center gap-1.5" onClick={() => { setEditingId(null); setForm({ username: '', password: '', nama: '', nidn: '', email: '', role: 'dosen', prodi_id: '' }); setShowForm(true) }}>
                <UserPlus className="w-4 h-4" /> Tambah User
              </button>
            </>
          )}
        </div>
      </div>

      {/* Single user form */}
      {showForm && (
        <div className="macos-card p-5 animate-scale-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900">{editingId ? 'Edit User' : 'Tambah User Baru'}</h3>
            <button onClick={closeForm} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
          <form onSubmit={editingId ? handleUpdate : handleCreate} className="grid grid-cols-2 gap-4">
            <div>
              <label className="macos-label">Username *</label>
              <input className="macos-input" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required disabled={!!editingId} placeholder="min. 3 karakter" />
            </div>
            {!editingId && (
              <div>
                <label className="macos-label">Password *</label>
                <input type="password" className="macos-input" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required placeholder="min. 4 karakter" />
              </div>
            )}
            <div>
              <label className="macos-label">Nama Lengkap *</label>
              <input className="macos-input" value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} required />
            </div>
            <div>
              <label className="macos-label">NIDN</label>
              <input className="macos-input" value={form.nidn} onChange={e => setForm({ ...form, nidn: e.target.value })} placeholder="Opsional" />
            </div>
            <div>
              <label className="macos-label">Email</label>
              <input type="email" className="macos-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Opsional" />
            </div>
            <div>
              <label className="macos-label">Role</label>
              <select className="macos-input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="macos-label">Program Studi</label>
              <select className="macos-input" value={form.prodi_id} onChange={e => setForm({ ...form, prodi_id: e.target.value })}>
                <option value="">-- Tidak ada / Semua Prodi --</option>
                {prodiList.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
              </select>
            </div>
            <div className="col-span-2 flex justify-end gap-3 pt-2">
              <button type="button" onClick={closeForm} className="macos-button-ghost">Batal</button>
              <button type="submit" className="macos-button">{editingId ? 'Update' : 'Simpan'}</button>
            </div>
          </form>
        </div>
      )}

      {/* ─── Bulk Import Modal ─────────────────────────────────────────────────── */}
      {showBulk && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="macos-card w-full max-w-3xl shadow-2xl animate-scale-in flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-900">Import Bulk User</h3>
                <p className="text-xs text-gray-400 mt-0.5">Format kolom (pisahkan dengan titik koma): <code className="bg-gray-100 px-1 rounded">username; password; nama; nidn; email; role; prodi_id</code></p>
              </div>
              <button onClick={closeBulkModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="overflow-y-auto p-5 space-y-4 flex-1">
              {/* Controls */}
              <div className="flex items-center gap-3">
                <div>
                  <label className="macos-label">Role Default</label>
                  <select className="macos-input" value={bulkDefaultRole} onChange={e => { setBulkDefaultRole(e.target.value); handleBulkTextChange(bulkText) }}>
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div className="flex-1" />
                <div className="text-right">
                  <label className="macos-label">Upload File CSV</label>
                  <div className="flex gap-2">
                    <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
                    <button type="button" onClick={() => fileRef.current?.click()} className="macos-button-ghost flex items-center gap-1.5 text-sm">
                      <Upload className="w-4 h-4" /> Pilih File
                    </button>
                  </div>
                </div>
              </div>

              {/* Paste area */}
              <div>
                <label className="macos-label">Tempel Data CSV</label>
                <textarea
                  className="macos-input font-mono text-xs resize-none"
                  rows={8}
                  placeholder={"# Contoh (kolom pisahkan dengan titik koma):\nusername1; pass1234; Nama Dosen Satu; 0123456789; email@kampus.ac.id; dosen; 1\nusername2; pass1234; Nama Dosen Dua\nketua01; pass1234; Dr. Ketua Prodi; ; ; ketua_prodi"}
                  value={bulkText}
                  onChange={e => handleBulkTextChange(e.target.value)}
                />
              </div>

              {/* Warnings */}
              {bulkWarnings.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-100 rounded-apple p-3 space-y-1">
                  {bulkWarnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-yellow-700">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      {w}
                    </div>
                  ))}
                </div>
              )}

              {/* Preview table */}
              {bulkPreview.length > 0 && !bulkResult && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">{bulkPreview.length} baris siap diimport:</p>
                  <div className="overflow-x-auto rounded-apple border border-gray-100">
                    <table className="w-full text-xs min-w-[600px]">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>
                          {['Username', 'Nama', 'NIDN', 'Email', 'Role', 'Prodi ID'].map(h => (
                            <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {bulkPreview.map((r, i) => {
                          const roleInfo = getRoleDisplay(r.role)
                          return (
                            <tr key={i} className="border-t border-gray-50 hover:bg-gray-50/50">
                              <td className="px-3 py-2 font-mono text-gray-800">{r.username}</td>
                              <td className="px-3 py-2 text-gray-700">{r.nama}</td>
                              <td className="px-3 py-2 text-gray-500">{r.nidn || '-'}</td>
                              <td className="px-3 py-2 text-gray-500">{r.email || '-'}</td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${roleInfo.color}`}>{roleInfo.label}</span>
                              </td>
                              <td className="px-3 py-2 text-gray-500">{r.prodi_id || '-'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Result */}
              {bulkResult && (
                <div className={`rounded-apple p-4 border ${bulkResult.errors === 0 ? 'bg-green-50 border-green-100' : 'bg-yellow-50 border-yellow-100'}`}>
                  <p className="font-medium text-sm text-gray-800">
                    {bulkResult.created} berhasil · {bulkResult.errors} gagal · {bulkResult.total} total
                  </p>
                  {bulkResult.error_detail?.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {bulkResult.error_detail.map((e: string, i: number) => (
                        <li key={i} className="text-xs text-red-600 flex items-start gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {e}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
              <button onClick={closeBulkModal} className="macos-button-ghost">Tutup</button>
              <button
                onClick={handleBulkSubmit}
                disabled={bulkSubmitting || bulkPreview.length === 0}
                className="macos-button disabled:opacity-50"
              >
                {bulkSubmitting ? 'Mengimport...' : `Import ${bulkPreview.length} User`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Reset password modal ─────────────────────────────────────────────── */}
      {passwordModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="macos-card p-6 w-full max-w-sm shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-semibold text-gray-900">Reset Password</h3>
                <p className="text-xs text-gray-400 mt-0.5">untuk <strong>{passwordModal.username}</strong></p>
              </div>
              <button onClick={() => setPasswordModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="macos-label">Password Baru *</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} className="macos-input pr-10" value={pwForm.newPassword} onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })} placeholder="min. 4 karakter" />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="macos-label">Konfirmasi Password *</label>
                <input type={showPw ? 'text' : 'password'} className={`macos-input ${pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword ? 'border-red-300 ring-1 ring-red-300' : ''}`} value={pwForm.confirmPassword} onChange={e => setPwForm({ ...pwForm, confirmPassword: e.target.value })} placeholder="Ulangi password baru" />
                {pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword && <p className="text-xs text-red-500 mt-1">Password tidak cocok</p>}
              </div>
              <button onClick={handleChangePassword} disabled={savingPw || !pwForm.newPassword || pwForm.newPassword !== pwForm.confirmPassword} className="macos-button w-full disabled:opacity-50 disabled:cursor-not-allowed">
                {savingPw ? 'Menyimpan...' : 'Simpan Password Baru'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Self change password modal ───────────────────────────────────────── */}
      {showSelfPwModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="macos-card p-6 w-full max-w-sm shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-semibold text-gray-900">Ganti Password Saya</h3>
                <p className="text-xs text-gray-400 mt-0.5">Login sebagai <strong>{(me as any)?.username || 'Anda'}</strong></p>
              </div>
              <button onClick={() => { setShowSelfPwModal(false); setSelfPwForm({ newPassword: '', confirmPassword: '' }) }} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="macos-label">Password Baru *</label>
                <div className="relative">
                  <input type={showSelfPw ? 'text' : 'password'} className="macos-input pr-10" value={selfPwForm.newPassword} onChange={e => setSelfPwForm({ ...selfPwForm, newPassword: e.target.value })} placeholder="min. 4 karakter" />
                  <button type="button" onClick={() => setShowSelfPw(!showSelfPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showSelfPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="macos-label">Konfirmasi Password *</label>
                <input type={showSelfPw ? 'text' : 'password'} className={`macos-input ${selfPwForm.confirmPassword && selfPwForm.newPassword !== selfPwForm.confirmPassword ? 'border-red-300 ring-1 ring-red-300' : ''}`} value={selfPwForm.confirmPassword} onChange={e => setSelfPwForm({ ...selfPwForm, confirmPassword: e.target.value })} placeholder="Ulangi password baru" />
                {selfPwForm.confirmPassword && selfPwForm.newPassword !== selfPwForm.confirmPassword && <p className="text-xs text-red-500 mt-1">Password tidak cocok</p>}
              </div>
              <button onClick={handleSelfChangePassword} disabled={!selfPwForm.newPassword || selfPwForm.newPassword !== selfPwForm.confirmPassword} className="macos-button w-full disabled:opacity-50 disabled:cursor-not-allowed">
                Simpan Password Baru
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Select-all bar ───────────────────────────────────────────────────── */}
      {bulkMode && !loading && users.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 rounded-apple bg-blue-50 border border-blue-100">
          <button onClick={toggleSelectAll} className="flex items-center gap-2 text-sm font-medium text-macos-blue">
            {selectedIds.size === users.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            {selectedIds.size === users.length ? 'Batal pilih semua' : 'Pilih semua'}
          </button>
          <span className="text-xs text-gray-500 ml-auto">{selectedIds.size} dari {users.length} dipilih</span>
        </div>
      )}

      {/* ─── Table ────────────────────────────────────────────────────────────── */}
      <div className="macos-card overflow-x-auto">
        <table className="w-full text-sm min-w-[750px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50 text-gray-500">
              {bulkMode && <th className="p-4 w-10" />}
              <th className="text-left p-4 font-medium">Username</th>
              <th className="text-left p-4 font-medium">Nama</th>
              <th className="text-left p-4 font-medium">NIDN</th>
              <th className="text-left p-4 font-medium">Email</th>
              <th className="text-left p-4 font-medium">Role</th>
              <th className="text-left p-4 font-medium">Status</th>
              <th className="text-right p-4 font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const roleInfo = getRoleDisplay(u.role)
              const isMe = (me as any)?.id === u.id
              return (
                <tr key={u.id} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${bulkMode && selectedIds.has(u.id) ? 'bg-blue-50/50' : ''}`}>
                  {bulkMode && (
                    <td className="p-4">
                      <button onClick={() => toggleSelect(u.id)} className="text-macos-blue" disabled={isMe}>
                        {selectedIds.has(u.id)
                          ? <CheckSquare className="w-4 h-4" />
                          : <Square className={`w-4 h-4 ${isMe ? 'text-gray-200' : 'text-gray-300'}`} />}
                      </button>
                    </td>
                  )}
                  <td className="p-4 font-medium text-gray-900">
                    {u.username}
                    {isMe && <span className="ml-1.5 text-[10px] text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded-full">Anda</span>}
                  </td>
                  <td className="p-4 text-gray-700">{u.nama}</td>
                  <td className="p-4 text-gray-500 font-mono text-xs">{u.nidn || '-'}</td>
                  <td className="p-4 text-gray-500 text-xs">{u.email || '-'}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleInfo.color}`}>{roleInfo.label}</span>
                  </td>
                  <td className="p-4">
                    <button onClick={() => toggleActive(u)} className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${u.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>
                      {u.is_active ? '● Aktif' : '○ Nonaktif'}
                    </button>
                  </td>
                  <td className="p-4 text-right">
                    {!bulkMode && (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEditForm(u)} className="p-1.5 rounded text-blue-400 hover:text-blue-600 hover:bg-blue-50" title="Edit profil"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => { setPasswordModal({ userId: u.id, username: u.username }); setPwForm({ newPassword: '', confirmPassword: '' }) }} className="p-1.5 rounded text-orange-400 hover:text-orange-600 hover:bg-orange-50" title="Reset password"><Key className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(u.id)} className="p-1.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30" title="Hapus user" disabled={isMe}><Trash2 className="w-4 h-4" /></button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!loading && users.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Users className="w-10 h-10 mb-2" />
            <p className="text-sm">Belum ada user</p>
          </div>
        )}
      </div>

      {/* ─── Floating bulk-delete bar ─────────────────────────────────────────── */}
      {bulkMode && selectedIds.size > 0 && (
        <div
          style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}
          className="flex items-center gap-4 px-6 py-3 rounded-full shadow-2xl bg-gray-900 text-white border border-gray-700"
        >
          <span className="text-sm font-medium">{selectedIds.size} dipilih</span>
          <div className="w-px h-4 bg-gray-600" />
          <button onClick={handleBulkDelete} disabled={bulkDeleting} className="flex items-center gap-2 text-sm font-semibold text-red-400 hover:text-red-300 transition-colors disabled:opacity-50">
            <Trash2 className="w-4 h-4" /> {bulkDeleting ? 'Menghapus...' : 'Hapus Terpilih'}
          </button>
          <button onClick={exitBulkMode} className="p-1 rounded-full hover:bg-gray-700 transition-colors text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
