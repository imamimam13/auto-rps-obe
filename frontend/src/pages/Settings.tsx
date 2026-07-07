import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Server, Database, Cpu, Download, RefreshCw } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'

export default function Settings() {
  const [ollamaStatus, setOllamaStatus] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')
  const [model, setModel] = useState('llama3.1:8b')

  useEffect(() => {
    checkOllama()
  }, [])

  async function checkOllama() {
    try {
      const res = await api.get('/api/v1/ollama/status')
      setOllamaStatus(res.data.available)
      if (res.data.available) {
        const mRes = await api.get('/api/v1/ollama/models')
        setModels(mRes.data.models || [])
      }
    } catch (e) {
      setOllamaStatus(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Pengaturan</h1>
        <p className="text-sm text-gray-500 mt-1">Konfigurasi aplikasi</p>
      </div>

      {/* Ollama Config */}
      <div className="macos-card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className={`p-2.5 rounded-apple-lg ${ollamaStatus ? 'bg-green-50' : 'bg-red-50'}`}>
            <Cpu className={`w-5 h-5 ${ollamaStatus ? 'text-green-500' : 'text-red-500'}`} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900">Ollama AI</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Status: {ollamaStatus ? (
                <span className="text-green-600 font-medium">Online</span>
              ) : (
                <span className="text-red-500 font-medium">Offline</span>
              )}
            </p>
          </div>
          <button onClick={checkOllama} className="macos-button-ghost p-2">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="macos-label">Ollama URL</label>
            <input className="macos-input" value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)} placeholder="http://localhost:11434" />
          </div>
          <div>
            <label className="macos-label">Model AI</label>
            <select className="macos-input" value={model} onChange={(e) => setModel(e.target.value)}>
              {models.length > 0 ? (
                models.map((m) => <option key={m} value={m}>{m}</option>)
              ) : (
                <option value="llama3.1:8b">llama3.1:8b</option>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="macos-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-apple-lg bg-blue-50">
            <Server className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Informasi Aplikasi</h3>
          </div>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-1.5 border-b border-gray-100">
            <span className="text-gray-500">Versi</span>
            <span className="text-gray-900">1.0.0</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-gray-100">
            <span className="text-gray-500">Framework</span>
            <span className="text-gray-900">FastAPI + React</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-gray-100">
            <span className="text-gray-500">AI Engine</span>
            <span className="text-gray-900">Ollama (Local LLM)</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-gray-500">Database</span>
            <span className="text-gray-900">PostgreSQL</span>
          </div>
        </div>
      </div>
    </div>
  )
}