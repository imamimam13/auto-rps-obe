import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  GraduationCap,
  BookOpen,
  FileText,
  CheckSquare,
  Settings,
  Sparkles,
} from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/prodi', icon: GraduationCap, label: 'Program Studi' },
  { to: '/mata-kuliah', icon: BookOpen, label: 'Mata Kuliah' },
  { to: '/rps', icon: FileText, label: 'RPS' },
  { to: '/obe', icon: CheckSquare, label: 'Validasi OBE' },
  { to: '/settings', icon: Settings, label: 'Pengaturan' },
]

export default function Sidebar() {
  return (
    <aside className="w-64 macos-sidebar flex flex-col h-screen">
      {/* App Header */}
      <div className="px-5 pt-10 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-apple-lg bg-gradient-to-br from-macos-blue to-purple-500 flex items-center justify-center shadow-sm">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-900">Auto RPS</h1>
            <p className="text-[11px] text-gray-500">Berbasis AI</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
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
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/30">
        <p className="text-[11px] text-gray-400">Auto RPS & OBE AI v1.0</p>
      </div>
    </aside>
  )
}