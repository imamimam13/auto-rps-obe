import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Sidebar from '@/components/layout/Sidebar'
import Dashboard from '@/pages/Dashboard'
import ProdiList from '@/pages/prodi/ProdiList'
import ProdiDetail from '@/pages/prodi/ProdiDetail'
import MataKuliahList from '@/pages/mata-kuliah/MataKuliahList'
import MataKuliahDetail from '@/pages/mata-kuliah/MataKuliahDetail'
import RPSList from '@/pages/rps/RPSList'
import RPSDetail from '@/pages/rps/RPSDetail'
import RPSGenerate from '@/pages/rps/RPSGenerate'
import OBEAnalyzer from '@/pages/obe/OBEAnalyzer'
import Settings from '@/pages/Settings'

export default function App() {
  return (
    <div className="flex h-screen bg-macos-bg">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl mx-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/prodi" element={<ProdiList />} />
            <Route path="/prodi/:id" element={<ProdiDetail />} />
            <Route path="/mata-kuliah" element={<MataKuliahList />} />
            <Route path="/mata-kuliah/:id" element={<MataKuliahDetail />} />
            <Route path="/rps" element={<RPSList />} />
            <Route path="/rps/:id" element={<RPSDetail />} />
            <Route path="/rps/generate/:mkId" element={<RPSGenerate />} />
            <Route path="/obe" element={<OBEAnalyzer />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </main>
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
    </div>
  )
}