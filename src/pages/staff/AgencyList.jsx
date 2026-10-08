import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/authContext'
import { getActiveAgencies } from '../../services/agencyService'
import Spinner from '../../components/ui/spinner'
import PageShell from '../../components/layout/PageShell'

const PALETTE = ['#1B5E37','#2563EB','#7C3AED','#D97706','#0891B2','#DC2626','#0D9488']

function initials(name) {
  return name.split(' ').slice(0,2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

export default function AgencyList() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [agencies, setAgencies] = useState([])
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening'
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
  const firstName = user?.name?.split(' ')[0] ?? 'there'

  useEffect(() => {
    getActiveAgencies()
      .then(d => setAgencies(d ?? []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleLogout = async () => { await logout(); navigate('/login') }

  return (
    <PageShell>
      <div className="min-h-screen pb-24 bg-slate-50">
        {/* Header */}
        <div className="bg-white border-b border-slate-100 sticky top-0 z-30">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">{user?.shopName ? `${user.shopName} · ` : ''}{dateStr}</p>
              <h1 className="text-lg font-semibold text-slate-900 mt-0.5">Good {greeting}, {firstName}</h1>
            </div>
            <button onClick={handleLogout}
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-600 flex items-center justify-center text-slate-500 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
            </button>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 pt-5 flex flex-col gap-5">
          {/* History shortcut */}
          {!loading && (
            <button onClick={() => navigate('/staff/history')}
              className="w-full bg-white border border-slate-100 rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-sm active:scale-[0.98] transition-all">
              <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
                <svg className="w-4 h-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-slate-900">Submission History</p>
                <p className="text-xs text-slate-400">View your past entries</p>
              </div>
              <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
            </button>
          )}

          {/* Agency list */}
          {loading ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : agencies.length === 0 ? (
            <div className="flex flex-col items-center py-20 gap-3">
              <div className="w-14 h-14 rounded-3xl bg-slate-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
              </div>
              <p className="text-slate-400 text-sm">No active agencies found.</p>
            </div>
          ) : (
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-widest px-1 mb-3">Select Agency</p>
              <div className="flex flex-col gap-2">
                {agencies.map((agency, i) => (
                  <button key={agency.id}
                    onClick={() => navigate(`/staff/agencies/${agency.id}`, { state: { agencyName: agency.name } })}
                    className="bg-white border border-slate-100 rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-sm hover:shadow-md active:scale-[0.98] transition-all w-full text-left">
                    <div className="w-4 h-full absolute left-0 top-0 bottom-0 rounded-l-2xl" style={{ background: PALETTE[i % PALETTE.length], width: 4 }} />
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-semibold shrink-0 ml-1"
                      style={{ background: PALETTE[i % PALETTE.length] }}>
                      {initials(agency.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{agency.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Tap to enter stock</p>
                    </div>
                    <svg className="w-4 h-4 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  )
}
