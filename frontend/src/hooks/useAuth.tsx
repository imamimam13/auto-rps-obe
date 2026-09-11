import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import api from '@/services/api'

interface User {
  id: number
  username: string
  nama: string
  email?: string
  nidn?: string
  role: 'admin' | 'ketua_prodi' | 'gmk' | 'dosen' | 'prodi' | string
  prodi_id?: number
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  isAdmin: boolean
  isKetuaProdi: boolean
  isGMK: boolean
  canEditRPS: boolean
  loading: boolean
}

const AuthContext = createContext<AuthContextType>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      api.get('/api/v1/auth/me')
        .then(r => setUser(r.data))
        .catch(() => { setToken(null); localStorage.removeItem('token') })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [token])

  async function login(username: string, password: string) {
    const res = await api.post('/api/v1/auth/login', { username, password })
    const { access_token, user: userData } = res.data
    localStorage.setItem('token', access_token)
    api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
    setToken(access_token)
    setUser(userData)
  }

  function logout() {
    localStorage.removeItem('token')
    delete api.defaults.headers.common['Authorization']
    setToken(null)
    setUser(null)
  }

  const roleLower = (user?.role || '').toLowerCase()
  const isAdmin = roleLower === 'admin'
  const isKetuaProdi = roleLower === 'ketua_prodi' || roleLower === 'prodi'
  const isGMK = roleLower === 'gmk' || roleLower === 'gkm' || roleLower === 'gmk_fakultas' || roleLower === 'gkm_fakultas' || roleLower === 'fakultas'
  const canEditRPS = isAdmin || isKetuaProdi || isGMK

  return (
    <AuthContext.Provider value={{
      user, token, login, logout,
      isAdmin,
      isKetuaProdi,
      isGMK,
      canEditRPS,
      loading,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)