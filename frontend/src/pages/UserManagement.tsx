import { useEffect, useState } from 'react'
import { Users, UserPlus, Trash2, Edit2, X, Key, Eye, EyeOff, Shield } from 'lucide-react'
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

function formatApiError(e: any, fallback: string): string {
  if (e?.response?.data?.detail) {
    const d = e.response.data.detail
    if (typeof d === 'string') return d
    if (Array.isArray(d)) return d.map((x: any) => `${x.loc?.join('.') || 'field'}: ${x.msg}`).join(', ')
  }
  return e?.message || fallback
}

export default function UserManagement() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<User[]>([])
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

  const [form, setForm] = useState({ username: '', password: '', nama: '', nidn: '', email: '', role: 'prodi' })

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    try {
      const res = await api.get('/api/v1/auth/users')
      setUsers(res.data)
    } catch { toast.error('Gagal memuat users') }
    finally { setLoading(false) }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    try {
      await api.post('/api/v1/auth/users', form)
      toast.success('User berhasil dibuat')
      closeForm()
      loadUsers()
    } catch (err: any) { toast.error(formatApiError(err, 'Gagal membuat user')) }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    try {
      await api.put(`/api/v1/auth/users/${editingId}`, { nama: form.nama, nidn: form.nidn, email: form.email, role: form.role })
      toast.success('User berhasil diperbarui')
      closeForm()
      loadUsers()
    } catch (err: any) { toast.error(formatApiError(err, 'Gagal memperbarui user')) }
  }

  async function handleDelete(id: number) {
    if (!confirm('Yakin hapus user ini? Tindakan ini tidak bisa dibatalkan.')) return
    try {
      await api.delete(`/api/v1/auth/users/${id}`)
      toast.success('User dihapus')
      loadUsers()
    } catch (err: any) { toast.error(formatApiError(err, 'Gagal menghapus')) }
  }

  async function toggleActive(user: User) {
    try {
      await api.put(`/api/v1/auth/users/${user.id}`, { is_active: !user.is_active })
      toast.success(`User ${user.is_active ? 'dinonaktifkan' : 'diaktifkan'}`)
      loadUsers()
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
    setForm({ username: user.username, password: '', nama: user.nama, nidn: user.nidn || '', email: user.email || '', role: user.role })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm({ username: '', password: '', nama: '', nidn: '', email: '', role: 'prodi' })
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Manajemen User</h1>
          <p className="text-sm text-gray-500 mt-1">Kelola akun prodi dan admin</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="macos-button-ghost flex items-center gap-1.5 text-sm text-orange-600 hover:bg-orange-50" onClick={() => setShowSelfPwModal(true)}>
            <Shield className="w-4 h-4" /> Ganti Password Saya
          </button>
          <button className="macos-button flex items-center gap-1.5" onClick={() => { setEditingId(null); setForm({ username: '', password: '', nama: '', nidn: '', email: '', role: 'prodi' }); setShowForm(true) }}>
            <UserPlus className="w-4 h-4" /> Tambah User
          </button>
        </div>
      </div>

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
                <option value="prodi">Prodi (Dosen)</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="col-span-2 flex items-center gap-2 pt-2">
              <button type="submit" className="macos-button">{editingId ? 'Update User' : 'Buat User'}</button>
              <button type="button" className="macos-button-ghost" onClick={closeForm}>Batal</button>
            </div>
          </form>
        </div>
      )}

      {passwordModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="macos-card p-6 w-full max-w-sm shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-semibold text-gray-900">Reset Password</h3>
                <p className="text-xs text-gray-400 mt-0.5">untuk <strong>{passwordModal.username}</strong></p>
              </div>
              <button onClick={() => { setPasswordModal(null); setPwForm({ newPassword: '', confirmPassword: '' }) }} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
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

      <div className="macos-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50 text-gray-500">
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
            {users.map(u => (
              <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                <td className="p-4 font-medium text-gray-900">
                  {u.username}
                  {(me as any)?.id === u.id && <span className="ml-1.5 text-[10px] text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded-full">Anda</span>}
                </td>
                <td className="p-4 text-gray-700">{u.nama}</td>
                <td className="p-4 text-gray-500 font-mono text-xs">{u.nidn || '-'}</td>
                <td className="p-4 text-gray-500 text-xs">{u.email || '-'}</td>
                <td className="p-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {u.role === 'admin' ? 'Admin' : 'Prodi'}
                  </span>
                </td>
                <td className="p-4">
                  <button onClick={() => toggleActive(u)} className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${u.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>
                    {u.is_active ? '● Aktif' : '○ Nonaktif'}
                  </button>
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEditForm(u)} className="p-1.5 rounded text-blue-400 hover:text-blue-600 hover:bg-blue-50" title="Edit profil"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => { setPasswordModal({ userId: u.id, username: u.username }); setPwForm({ newPassword: '', confirmPassword: '' }) }} className="p-1.5 rounded text-orange-400 hover:text-orange-600 hover:bg-orange-50" title="Reset password"><Key className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(u.id)} className="p-1.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30" title="Hapus user" disabled={(me as any)?.id === u.id}><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && users.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Users className="w-10 h-10 mb-2" />
            <p className="text-sm">Belum ada user</p>
          </div>
        )}
      </div>
    </div>
  )
}
