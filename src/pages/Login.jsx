import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/authContext'
import Alert from '../components/ui/alert'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password.trim()) { setError('Enter both username and password'); return }
    setLoading(true)
    try {
      const user = await login(username.trim(), password)
      if (user.role === 'super_admin') navigate('/super/dashboard')
      else if (user.role === 'admin') navigate('/admin/dashboard')
      else navigate('/staff/agencies')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg, #0F1A12 0%, #1B5E37 100%)' }}>
      {/* Top: logo area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-8">
        <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center mb-5">
          <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 22V12h6v10"/>
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-white mb-1">Stock Portal</h1>
        <p className="text-white/50 text-sm">Sampath Super Market</p>
      </div>

      {/* Bottom: form card */}
      <div className="bg-white rounded-t-3xl px-6 pt-7 pb-10 shadow-2xl">
        <h2 className="text-lg font-semibold text-slate-900 mb-6">Sign in</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Username</label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter username"
                autoCapitalize="none" autoCorrect="off"
                className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent focus:bg-white transition-all" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password"
                className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent focus:bg-white transition-all" />
            </div>
          </div>
          <Alert type="error" message={error} />
          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white py-3.5 rounded-xl text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-60 mt-1">
            {loading
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <>Sign in <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg></>
            }
          </button>
        </form>
        <p className="text-xs text-slate-400 text-center mt-6">Contact admin if you forgot your password</p>
      </div>
    </div>
  )
}
