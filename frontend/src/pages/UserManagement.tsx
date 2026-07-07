import { useEffect, useState } from 'react'
import { Users, UserPlus, Trash2, Shield, ShieldOff } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'

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

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', nama: '', nidn: '', role: 'dosen' })

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
      setShowForm(false)
      setForm({ username: '', password: '', nama: '', nidn: '', role: 'dosen' })
      loadUsers()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Gagal membuat user')
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Yakin hapus user ini?')) return
    try {
      await api.delete(`/api/v1/auth/users/${id}`)
      toast.success('User dihapus')
      loadUsers()
    } catch { toast.error('Gagal menghapus') }
  }

  async function toggleActive(user: User) {
    try {
      await api.put(`/api/v1/auth/users/${user.id}`, { is_active: !user.is_active })
      loadUsers()
    } catch { toast.error('Gagal update') }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Manajemen User</h1>
          <p className="text-sm text-gray-500 mt-1">Kelola akun dosen dan admin</p>
        </div>
        <button className="macos-button" onClick={() => setShowForm(!showForm)}>
          <UserPlus className="w-4 h-4" /> Tambah User
        </button>
      </div>

      {showForm && (
        <div className="macos-card p-5 animate-scale-in">
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div>
              <label className="macos-label">Username *</label>
              <input className="macos-input" value={form.username} onChange={e => setForm({...form, username: e.target.value})} required />
            </div>
            <div>
              <label className="macos-label">Password *</label>
              <input type="password" className="macos-input" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
            </div>
            <div>
              <label className="macos-label">Nama *</label>
              <input className="macos-input" value={form.nama} onChange={e => setForm({...form, nama: e.target.value})} required />
            </div>
            <div>
              <label className="macos-label">NIDN</label>
              <input className="macos-input" value={form.nidn} onChange={e => setForm({...form, nidn: e.target.value})} />
            </div>
            <div>
              <label className="macos-label">Role</label>
              <select className="macos-input" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                <option value="dosen">Dosen</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button type="submit" className="macos-button">Simpan</button>
              <button type="button" className="macos-button macos-button-secondary" onClick={() => setShowForm(false)}>Batal</button>
            </div>
          </form>
        </div>
      )}

      <div className="macos-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-gray-500">
              <th className="text-left p-4 font-medium">Username</th>
              <th className="text-left p-4 font-medium">Nama</th>
              <th className="text-left p-4 font-medium">NIDN</th>
              <th className="text-left p-4 font-medium">Role</th>
              <th className="text-left p-4 font-medium">Status</th>
              <th className="text-right p-4 font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="p-4 font-medium">{u.username}</td>
                <td className="p-4">{u.nama}</td>
                <td className="p-4 text-gray-500">{u.nidn || '-'}</td>
                <td className="p-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="p-4">
                  <button onClick={() => toggleActive(u)} className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {u.is_active ? 'Aktif' : 'Nonaktif'}
                  </button>
                </td>
                <td className="p-4 text-right">
                  <button onClick={() => handleDelete(u.id)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
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