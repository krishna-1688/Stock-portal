import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/authContext'
import { getAdminCounts, getAgencyStatus } from '../../services/stockService'
import Spinner from '../../components/ui/spinner'
import AdminBottomNav from '../../components/layout/AdminBottomNav'

function StatCard({ label, value, icon, color }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ background: color }} />
      <div className="flex items-center justify-between mb-1">
        <p className="text-2xl font-semibold text-slate-900">{value ?? '—'}</p>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: color + '18' }}>
          {icon}
        </div>
      </div>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</p>
    </div>
  )
}

export default function AdminDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [counts, setCounts] = useState(null)
  const [statusList, setStatusList] = useState([])
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  useEffect(() => {
    Promise.all([getAdminCounts(), getAgencyStatus()])
      .then(([c, s]) => { setCounts(c?.[0] ?? c); setStatusList(s ?? []) })
      .catch(console.error).finally(() => setLoading(false))
  }, [])

  const submittedToday = statusList.filter(s => s.submitted_today).length
  const pendingToday   = statusList.length - submittedToday
  const pct            = statusList.length ? Math.round((submittedToday / statusList.length) * 100) : 0

  const handleLogout = async () => { await logout(); navigate('/login') }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-brand-600 sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 pt-4 pb-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
              </div>
              <div>
                <p className="text-xs text-white/60">{user?.role === 'super_admin' ? 'Super Admin' : 'Admin Panel'}</p>
                <p className="text-sm font-semibold text-white leading-none">{user?.shopName ?? 'Stock Portal'}</p>
              </div>
            </div>
            <button onClick={handleLogout}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"/></svg>
            </button>
          </div>
          <p className="text-white/60 text-xs mb-1">{greeting}</p>
          <p className="text-white text-xl font-semibold mb-4">{user?.name?.split(' ')[0]}</p>
          {!loading && statusList.length > 0 && (
            <div>
              <div className="flex justify-between text-xs text-white/60 mb-1.5">
                <span>Today's progress</span>
                <span>{submittedToday}/{statusList.length}</span>
              </div>
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="bg-white/10 rounded-xl p-2.5 text-center">
                  <p className="text-lg font-semibold text-white">{submittedToday}</p>
                  <p className="text-white/60 text-xs">Submitted</p>
                </div>
                <div className="bg-white/10 rounded-xl p-2.5 text-center">
                  <p className="text-lg font-semibold text-amber-300">{pendingToday}</p>
                  <p className="text-white/60 text-xs">Pending</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-28 -mt-2">
        {/* Stats */}
        <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-3 mt-5">Overview</p>
        {loading ? <div className="flex justify-center py-10"><Spinner /></div> : (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <StatCard label="Agencies" value={counts?.total_agencies} color="#1B5E37"
              icon={<svg className="w-4 h-4" style={{color:'#1B5E37'}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>} />
            <StatCard label="Products" value={counts?.total_products} color="#D97706"
              icon={<svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>} />
            <div className="col-span-2 bg-white rounded-2xl border border-slate-100 p-4 shadow-sm relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-violet-500" />
              <p className="text-3xl font-semibold text-slate-900">{counts?.total_submissions ?? '—'}</p>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mt-1">All-time submissions</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-3">Quick Actions</p>
        <div className="flex flex-col gap-2">
          {[
            { label: 'Agency Status', desc: 'See which agencies submitted today', path: '/admin/status', color: '#1B5E37' },
            { label: 'Submission History', desc: 'Browse all past stock entries', path: '/admin/history', color: '#7C3AED' },
          ].map(item => (
            <button key={item.path} onClick={() => navigate(item.path)}
              className="group bg-white rounded-2xl border border-slate-100 px-4 py-3.5 flex items-center gap-3 shadow-sm hover:shadow-md active:scale-[0.98] transition-all w-full text-left">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: item.color + '15' }}>
                <svg className="w-4 h-4" style={{ color: item.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {item.label === 'Agency Status'
                    ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    : <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>}
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900">{item.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
              </div>
              <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
            </button>
          ))}
        </div>
      </div>
      <AdminBottomNav />
    </div>
  )
}
