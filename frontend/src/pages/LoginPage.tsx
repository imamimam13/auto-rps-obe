import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, LogIn, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await login(username, password)
      toast.success('Login berhasil')
      navigate('/dashboard')
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Login gagal')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-macos-bg flex items-center justify-center p-6">
      <div className="macos-window p-8 w-full max-w-sm animate-scale-in">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-apple-xl bg-gradient-to-br from-macos-blue to-purple-500 flex items-center justify-center mx-auto mb-4 shadow-apple">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Auto RPS & OBE</h1>
          <p className="text-sm text-gray-500 mt-1">Masuk ke akun Anda</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="macos-label">Username</label>
            <input
              className="macos-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="macos-label">Password</label>
            <input
              type="password"
              className="macos-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="macos-button w-full py-2.5 flex items-center justify-center gap-2"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Masuk...</>
            ) : (
              <><LogIn className="w-4 h-4" /> Masuk</>
            )}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-6">
          Default: admin / admin
        </p>
      </div>
    </div>
  )
}