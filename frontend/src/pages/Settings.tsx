import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Server, Cpu, RefreshCw, Link, Key } from 'lucide-react'
import api from '@/services/api'
import toast from 'react-hot-toast'

const providers = [
  { value: 'ollama', label: 'Ollama (Local)' },
  { value: 'lmstudio', label: 'LM Studio' },
  { value: '9router', label: '9Router' },
  { value: 'openai', label: 'OpenAI Compatible' },
]

export default function Settings() {
  const [aiStatus, setAiStatus] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [provider, setProvider] = useState('ollama')
  const [aiUrl, setAiUrl] = useState('http://localhost:11434')
  const [model, setModel] = useState('llama3.1:8b')
  const [apiKey, setApiKey] = useState('')
  const [connecting, setConnecting] = useState(false)

  useEffect(() => { checkAI() }, [])

  async function checkAI() {
    try {
      const res = await api.get('/api/v1/ollama/status')
      setAiStatus(res.data.available)
      if (res.data.provider) setProvider(res.data.provider)
      if (res.data.base_url) setAiUrl(res.data.base_url)
      if (res.data.model) setModel(res.data.model)
      if (res.data.api_key) setApiKey(res.data.api_key)
      if (res.data.available) {
        const mRes = await api.get('/api/v1/ollama/models')
        setModels(mRes.data.models || [])
      }
    } catch {
      setAiStatus(false)
    }
  }

  async function connectAI() {
    setConnecting(true)
    try {
      const res = await api.post('/api/v1/ollama/configure', {
        provider,
        base_url: aiUrl,
        model,
        api_key: apiKey,
      })
      setAiStatus(res.data.available)
      if (res.data.available) {
        const mRes = await api.get('/api/v1/ollama/models')
        setModels(mRes.data.models || [])
        toast.success('Terhubung ke AI!')
      } else {
        toast.error('AI tidak merespon')
      }
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Gagal terhubung')
    } finally {
      setConnecting(false)
    }
  }

  function handleProviderChange(p: string) {
    setProvider(p)
    const defaults: Record<string, string> = {
      ollama: 'http://localhost:11434',
      lmstudio: 'http://localhost:1234',
      '9router': 'https://9router.ai/v1',
      openai: 'https://api.openai.com/v1',
    }
    setAiUrl(defaults[p] || '')
  }

  async function handleModelChange(newModel: string) {
    setModel(newModel)
    try {
      await api.post('/api/v1/ollama/configure', { provider, base_url: aiUrl, model: newModel, api_key: apiKey })
      toast.success(`Model: ${newModel}`)
    } catch { toast.error('Gagal ganti model') }
  }

  const needsApiKey = provider !== 'ollama'

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Pengaturan</h1>
        <p className="text-sm text-gray-500 mt-1">Konfigurasi aplikasi</p>
      </div>

      <div className="macos-card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className={`p-2.5 rounded-apple-lg ${aiStatus ? 'bg-green-50' : 'bg-red-50'}`}>
            <Cpu className={`w-5 h-5 ${aiStatus ? 'text-green-500' : 'text-red-500'}`} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900">AI Engine</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Status: {aiStatus ? (
                <span className="text-green-600 font-medium">Online</span>
              ) : (
                <span className="text-red-500 font-medium">Offline</span>
              )}
            </p>
          </div>
          <button onClick={checkAI} className="macos-button-ghost p-2" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="macos-label">Provider</label>
            <select className="macos-input" value={provider} onChange={(e) => handleProviderChange(e.target.value)}>
              {providers.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="macos-label">Base URL</label>
            <input className="macos-input" value={aiUrl} onChange={(e) => setAiUrl(e.target.value)} placeholder="http://localhost:11434" />
          </div>
          {needsApiKey && (
            <div>
              <label className="macos-label flex items-center gap-1.5"><Key className="w-3.5 h-3.5" /> API Key</label>
              <input type="password" className="macos-input" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." />
            </div>
          )}
          <div>
            <label className="macos-label">Model</label>
            <select className="macos-input" value={model} onChange={(e) => handleModelChange(e.target.value)}>
              {models.length > 0 ? (
                models.map(m => <option key={m} value={m}>{m}</option>)
              ) : (
                <option value={model}>{model}</option>
              )}
            </select>
            {models.length > 0 && <p className="text-[11px] text-gray-400 mt-1">{models.length} model tersedia</p>}
          </div>
          <button onClick={connectAI} disabled={connecting} className="macos-button w-full py-2 flex items-center justify-center gap-2">
            <Link className="w-4 h-4" />
            {connecting ? 'Menghubungkan...' : 'Hubungkan & Simpan'}
          </button>
        </div>
      </div>

      <div className="macos-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-apple-lg bg-blue-50">
            <Server className="w-5 h-5 text-blue-500" />
          </div>
          <div><h3 className="text-sm font-semibold text-gray-900">Informasi Aplikasi</h3></div>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-1.5 border-b border-gray-100">
            <span className="text-gray-500">Versi</span><span className="text-gray-900">1.0.0</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-gray-100">
            <span className="text-gray-500">Framework</span><span className="text-gray-900">FastAPI + React</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-gray-500">Database</span><span className="text-gray-900">SQLite</span>
          </div>
        </div>
      </div>
    </div>
  )
}
