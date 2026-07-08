import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
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
  if (!user) return null

  return (
    <div className="flex h-screen bg-macos-bg">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl mx-auto">
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