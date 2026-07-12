import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  GraduationCap,
  BookOpen,
  FileText,
  CheckSquare,
  Settings,
  Sparkles,
  Users,
  LogOut,
  X,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/prodi', icon: GraduationCap, label: 'Program Studi' },
  { to: '/mata-kuliah', icon: BookOpen, label: 'Mata Kuliah' },
  { to: '/rps', icon: FileText, label: 'RPS' },
  { to: '/obe', icon: CheckSquare, label: 'Validasi OBE' },
  { to: '/settings', icon: Settings, label: 'Pengaturan' },
]

export default function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    onClose?.()
    navigate('/login')
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 md:relative md:translate-x-0 w-64 macos-sidebar flex flex-col h-screen transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* App Header */}
      <div className="px-5 pt-6 md:pt-10 pb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-apple-lg bg-gradient-to-br from-macos-blue to-purple-500 flex items-center justify-center shadow-sm">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-900">Auto RPS</h1>
            <p className="text-[11px] text-gray-500">Berbasis AI</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="md:hidden p-1.5 rounded-apple hover:bg-black/5 transition-colors"
          aria-label="Tutup menu"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={() => onClose?.()}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-apple text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-macos-blue/10 text-macos-blue'
                  : 'text-gray-600 hover:bg-black/[0.04] hover:text-gray-900'
              }`
            }
          >
            <item.icon className="w-4.5 h-4.5" size={18} />
            <span>{item.label}</span>
          </NavLink>
        ))}

        {isAdmin && (
          <NavLink
            to="/admin/users"
            onClick={() => onClose?.()}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-apple text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-macos-blue/10 text-macos-blue'
                  : 'text-gray-600 hover:bg-black/[0.04] hover:text-gray-900'
              }`
            }
          >
            <Users className="w-4.5 h-4.5" size={18} />
            <span>Manajemen User</span>
          </NavLink>
        )}
      </nav>

      {/* User Info & Logout */}
      <div className="px-4 py-4 border-t border-white/30 space-y-3">
        <div className="flex items-center gap-2.5 px-1">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-macos-blue to-purple-400 flex items-center justify-center text-white text-xs font-semibold">
            {user?.nama.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">{user?.nama}</p>
            <p className="text-[10px] text-gray-400 capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-1.5 w-full rounded-apple text-sm text-gray-500 hover:text-red-500 hover:bg-red-50 transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  )
}