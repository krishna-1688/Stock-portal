import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/authContext'
import { getAgencyStatus } from '../../services/stockService'
import Spinner from '../../components/ui/spinner'

export default function AgencyStatus() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [statusList, setStatusList] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all | submitted | pending

  useEffect(() => {
    getAgencyStatus()
      .then(data => setStatusList(data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const submitted = statusList.filter(s => s.submitted_today)
  const pending = statusList.filter(s => !s.submitted_today)
  const pct = statusList.length ? Math.round((submitted.length / statusList.length) * 100) : 0

  const filtered = filter === 'submitted' ? submitted : filter === 'pending' ? pending : statusList

  const handleLogout = async () => { await logout(); navigate('/login') }

  return (
    <div className="min-h-screen bg-[#F5F6FA]">

      {/* Top Bar */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/admin/dashboard')} className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
              <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <p className="text-sm font-black text-gray-900 leading-none">Agency Status</p>
              <p className="text-xs text-gray-400 leading-none mt-0.5">
                {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-9 h-9 rounded-xl bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors">
            <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
            </svg>
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-32 pt-5">

        {/* Progress Banner */}
        {!loading && statusList.length > 0 && (
          <div className="relative overflow-hidden rounded-[24px] p-5 mb-5 shadow-lg"
            style={{ background: pct === 100 ? 'linear-gradient(135deg,#16a34a,#15803d)' : 'linear-gradient(135deg,#1e40af,#1e3a8a)' }}>
            <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-white/5" />
            <div className="relative">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-1">Today's Coverage</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-5xl font-black text-white">{submitted.length}</span>
                    <span className="text-white/40 text-2xl font-bold">/{statusList.length}</span>
                  </div>
                  <p className="text-white/60 text-sm mt-1">
                    {pct === 100 ? '🎉 All agencies submitted!' : `${pending.length} still pending`}
                  </p>
                </div>
                <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center">
                  <span className="text-2xl font-black text-white">{pct}%</span>
                </div>
              </div>
              <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: 'rgba(255,255,255,0.15)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: 'rgba(255,255,255,0.85)' }} />
              </div>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-5">
          {[
            { key: 'all', label: `All (${statusList.length})` },
            { key: 'submitted', label: `✅ Done (${submitted.length})` },
            { key: 'pending', label: `⏳ Pending (${pending.length})` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex-1 py-2.5 rounded-2xl text-xs font-bold transition-all duration-200 ${
                filter === tab.key
                  ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30'
                  : 'bg-white text-gray-500 border border-gray-100 hover:border-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Agency Cards */}
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((agency, i) => {
              const timeStr = agency.submitted_at
                ? new Date(agency.submitted_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                : null
              return (
                <div
                  key={agency.agency_id}
                  className="bg-white rounded-[20px] border border-gray-100 px-4 py-4 flex items-center gap-4 shadow-sm"
                >
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg shrink-0 ${
                    agency.submitted_today ? 'bg-brand-50' : 'bg-amber-50'
                  }`}>
                    {agency.submitted_today ? '✅' : '⏳'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-bold text-gray-900 truncate">{agency.agency_name}</p>
                    <p className={`text-xs font-semibold mt-0.5 ${agency.submitted_today ? 'text-brand-600' : 'text-amber-500'}`}>
                      {agency.submitted_today
                        ? `Submitted at ${timeStr}`
                        : 'Pending entry'}
                    </p>
                  </div>
                 <button
  onClick={() => navigate(`/admin/agencies/${agency.agency_id}`, { state: { agencyName: agency.agency_name } })}
  className="shrink-0 w-8 h-8 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors"
>
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <div className="flex flex-col items-center py-16 gap-3">
                <div className="w-14 h-14 rounded-3xl bg-gray-100 flex items-center justify-center text-3xl">🏪</div>
                <p className="text-gray-500 font-medium text-sm">No agencies found.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4">
        <div className="max-w-lg mx-auto">
          <nav className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl shadow-black/10 border border-gray-100 flex justify-around py-2 px-2">
            {[
              { icon: '📊', label: 'Dashboard', path: '/admin/dashboard' },
              {icon: '🏪', label:'Agencies',path:'/admin/agencies' },
              { icon: '✅', label: 'Status', path: '/admin/status' },
              { icon: '📋', label: 'History', path: '/admin/history' },
            ].map(item => {
              const active = window.location.pathname === item.path
              return (
                <button key={item.path} onClick={() => navigate(item.path)}
                  className={`flex flex-col items-center gap-1 px-5 py-2 rounded-2xl transition-all duration-200 ${active ? 'bg-brand-600 shadow-lg shadow-brand-600/30' : 'hover:bg-gray-50'}`}>
                  <span className="text-lg">{item.icon}</span>
                  <span className={`text-xs font-bold ${active ? 'text-white' : 'text-gray-400'}`}>{item.label}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </div>
    </div>
  )
}