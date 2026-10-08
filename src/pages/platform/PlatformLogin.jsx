import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/button'
import Alert from '../../components/ui/alert'
import { platformLogin } from '../../services/platformService'
import { savePlatformToken } from '../../utils/session'

const inputCls =
  'w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent'

export default function PlatformLogin() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password) { setError('Please enter both username and password'); return }
    setLoading(true)
    try {
      const result = await platformLogin(username.trim(), password)
      if (!result?.token) throw new Error('Incorrect username or password')
      savePlatformToken(result.token)
      navigate('/platform', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="w-16 h-16 bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-900/50">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Stock Portal Platform</h1>
          <p className="text-slate-400 text-sm mt-1">Owner console · manage all shops</p>
        </div>
      </div>

      <div className="bg-slate-900 rounded-2xl border border-slate-800 w-full max-w-sm p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Username</label>
            <input
              className={inputCls}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
            <input
              type="password"
              className={inputCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <Alert type="error" message={error} />
          <Button type="submit" loading={loading} fullWidth size="lg">Sign in</Button>
        </form>
      </div>
    </div>
  )
}
