import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/authContext'
import Alert from '../components/ui/alert'

// Public demo shop "Demo Mart" (db/005). Shared by everyone, resets nightly.
const DEMO_PASSWORD = 'demo1234'

const ROLES = [
  {
    username: 'demo_staff',
    title: 'Staff',
    who: 'Arjun · counts stock in the store',
    points: ['Pick an agency, enter counts with + / −', 'Drafts are saved if you get interrupted', 'See your past entries'],
    color: '#2563EB',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />,
  },
  {
    username: 'demo_admin',
    title: 'Admin',
    who: 'Rahul · manages ordering',
    points: ['See which agencies counted stock today', 'Check current stock, spot low items', 'Send an order on WhatsApp in one tap'],
    color: '#1B5E37',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
  },
  {
    username: 'demo_super',
    title: 'Super Admin',
    who: 'Priya · owns the shop',
    points: ['Add agencies and products (bulk add too)', 'Manage staff and admins', 'Browse every WhatsApp order sent'],
    color: '#7C3AED',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />,
  },
]

export default function Demo() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')

  const enter = async (username) => {
    setBusy(username); setError('')
    try {
      const user = await login(username, DEMO_PASSWORD)
      if (user.role === 'super_admin') navigate('/super/dashboard')
      else if (user.role === 'admin') navigate('/admin/dashboard')
      else navigate('/staff/agencies')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div style={{ background: 'linear-gradient(160deg, #0F1A12 0%, #1B5E37 100%)' }}>
        <div className="max-w-lg lg:max-w-4xl mx-auto px-6 pt-14 pb-24 text-center">
          <img src="/favicon.svg" alt="" className="w-14 h-14 rounded-2xl mx-auto mb-5 ring-1 ring-white/20" />
          <h1 className="text-2xl sm:text-3xl font-semibold text-white">Try Stock Portal</h1>
          <p className="text-white/60 text-sm sm:text-base mt-2 max-w-md mx-auto">
            A live demo shop, <span className="text-white">Demo Mart</span>, with agencies, products and 10 days of history.
            Pick a role to step in, no sign-up needed.
          </p>
        </div>
      </div>

      <div className="max-w-lg lg:max-w-4xl mx-auto px-4 -mt-14 pb-12">
        {error && <div className="mb-4"><Alert type="error" message={error} /></div>}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {ROLES.map((r) => (
            <div key={r.username} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: r.color }} />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: r.color + '15', color: r.color }}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>{r.icon}</svg>
                </div>
                <div>
                  <p className="text-base font-semibold text-slate-900">{r.title}</p>
                  <p className="text-xs text-slate-400">{r.who}</p>
                </div>
              </div>
              <ul className="mt-4 flex flex-col gap-2 flex-1">
                {r.points.map((p) => (
                  <li key={p} className="flex gap-2 text-sm text-slate-600">
                    <svg className="w-4 h-4 mt-0.5 shrink-0 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    {p}
                  </li>
                ))}
              </ul>
              <button onClick={() => enter(r.username)} disabled={!!busy}
                className="mt-5 w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white py-3 rounded-xl text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-60">
                {busy === r.username
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <>Enter as {r.title} <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg></>}
              </button>
              <p className="text-[11px] text-slate-400 text-center mt-2 font-mono">{r.username} · {DEMO_PASSWORD}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 bg-white rounded-2xl border border-slate-100 px-4 py-3.5 flex gap-3 items-start">
          <svg className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <p className="text-xs text-slate-500 leading-relaxed">
            Everyone shares this demo and it resets every night. Please don't enter real information.
            User management is read-only here, and WhatsApp orders go to a dummy number.
            Works best on a phone; it can be installed like an app from the browser menu.
          </p>
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          Have a shop account?{' '}
          <button onClick={() => navigate('/login')} className="font-medium text-brand-600 hover:underline">Sign in to your shop</button>
        </p>
      </div>
    </div>
  )
}
