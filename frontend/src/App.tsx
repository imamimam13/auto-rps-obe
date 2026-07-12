import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { Menu } from 'lucide-react'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import Sidebar from '@/components/layout/Sidebar'
import LoginPage from '@/pages/LoginPage'
import Dashboard from '@/pages/Dashboard'
import ProdiList from '@/pages/prodi/ProdiList'
import ProdiDetail from '@/pages/prodi/ProdiDetail'
import MataKuliahList from '@/pages/mata-kuliah/MataKuliahList'
import MataKuliahDetail from '@/pages/mata-kuliah/MataKuliahDetail'
import BulkImport from '@/pages/mata-kuliah/BulkImport'
import RPSList from '@/pages/rps/RPSList'
import RPSDetail from '@/pages/rps/RPSDetail'
import RPSGenerate from '@/pages/rps/RPSGenerate'
import OBEAnalyzer from '@/pages/obe/OBEAnalyzer'
import UserManagement from '@/pages/UserManagement'
import Settings from '@/pages/Settings'

import LandingPage from '@/pages/LandingPage'
import RPSPublicPreview from '@/pages/RPSPublicPreview'

function AppLayout() {
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (!user) return null

  return (
    <div className="flex flex-col md:flex-row h-screen bg-macos-bg overflow-hidden">
      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur-md border-b border-gray-200/50 shrink-0">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-1.5 rounded-apple hover:bg-black/5 transition-colors"
          aria-label="Buka menu"
        >
          <Menu className="w-5 h-5 text-gray-700" />
        </button>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-gray-900">Auto RPS</span>
        </div>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-macos-blue to-purple-400 flex items-center justify-center text-white text-xs font-semibold">
          {user?.nama.charAt(0).toUpperCase()}
        </div>
      </header>

      {/* Main Container Wrapper */}
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        {/* Backdrop overlay on Mobile when sidebar is open */}
        {sidebarOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black/30 backdrop-blur-xs z-40 transition-opacity duration-300"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6 max-w-7xl mx-auto">
            <Routes>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/prodi" element={<ProdiList />} />
              <Route path="/prodi/:id" element={<ProdiDetail />} />
              <Route path="/mata-kuliah" element={<MataKuliahList />} />
              <Route path="/mata-kuliah/bulk-import" element={<BulkImport />} />
              <Route path="/mata-kuliah/:id" element={<MataKuliahDetail />} />
              <Route path="/rps" element={<RPSList />} />
              <Route path="/rps/:id" element={<RPSDetail />} />
              <Route path="/rps/generate/:mkId" element={<RPSGenerate />} />
              <Route path="/obe" element={<OBEAnalyzer />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/admin/users" element={
                <ProtectedRoute adminOnly>
                  <UserManagement />
                </ProtectedRoute>
              } />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/rps-preview/:id" element={<RPSPublicPreview />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        } />
      </Routes>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(20px)',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            border: '1px solid rgba(255,255,255,0.4)',
            fontSize: '14px',
          },
        }}
      />
    </AuthProvider>
  )
}