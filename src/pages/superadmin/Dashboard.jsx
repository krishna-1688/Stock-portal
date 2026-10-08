import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/authContext'
import { getSuperAdminCounts } from '../../services/stockService'
import Spinner from '../../components/ui/spinner'

const PALETTE = ['#1B5E37','#2563EB','#7C3AED','#D97706']

export default function SuperDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [counts, setCounts] = useState(null)
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr = now.toLocaleDateString('en-IN', {weekday:'long',day:'numeric',month:'long',year:'numeric'})

  useEffect(() => {
    getSuperAdminCounts().then(d => setCounts(d?.[0])).catch(console.error).finally(() => setLoading(false))
  }, [])

  const handleLogout = async () => { await logout(); navigate('/login') }

  const stats = counts ? [
    { label: 'Staff accounts', value: counts.total_staff, color: '#1B5E37' },
    { label: 'Agencies', value: counts.total_agencies, color: '#2563EB' },
    { label: 'Products', value: counts.total_products, color: '#D97706' },
    { label: 'Submissions', value: counts.total_submissions, color: '#7C3AED' },
  ] : []

  const manageItems = [
    { label: 'Users', desc: 'Add admins & staff · reset passwords', path: '/super/users', color: '#1B5E37' },
    { label: 'Agencies', desc: 'Add, edit or archive agencies', path: '/super/agencies', color: '#2563EB' },
    { label: 'Products', desc: 'Add products, assign to agencies', path: '/super/products', color: '#D97706' },
  ]

  const reportItems = [
    { label: 'Agency Status', desc: 'See which agencies submitted today', path: '/admin/status', color: '#7C3AED' },
    { label: 'Submission History', desc: 'Browse all past stock entries', path: '/admin/history', color: '#0891B2' },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 leading-none">{user?.shopName ?? 'Stock Portal'}</p>
              <p className="text-xs text-slate-400 leading-none mt-0.5">Super Admin</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-medium text-slate-700">{user?.name}</p>
              <p className="text-xs text-brand-600">Super Admin</p>
            </div>
            <button onClick={handleLogout}
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-500 flex items-center justify-center text-slate-500 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"/></svg>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-28 pt-5">
        {/* Greeting */}
        <div className="mb-5">
          <p className="text-xs text-slate-400">{dateStr}</p>
          <p className="text-xl font-semibold text-slate-900 mt-1">{greeting}, {user?.name?.split(' ')[0]}</p>
        </div>

        {/* Stats grid */}
        <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-3">Overview</p>
        {loading ? <div className="flex justify-center py-10"><Spinner /></div> : (
          <div className="grid grid-cols-2 gap-3 mb-6">
            {stats.map(s => (
              <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ background: s.color }} />
                <p className="text-2xl font-semibold text-slate-900">{s.value ?? '—'}</p>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Manage */}
        <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-3">Manage</p>
        <div className="flex flex-col gap-2 mb-6">
          {manageItems.map(item => (
            <button key={item.path} onClick={() => navigate(item.path)}
              className="group bg-white rounded-2xl border border-slate-100 px-4 py-3.5 flex items-center gap-3 shadow-sm hover:shadow-md active:scale-[0.98] transition-all w-full text-left">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: item.color + '15' }}>
                <svg className="w-4 h-4" style={{ color: item.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {item.label === 'Users' && <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>}
                  {item.label === 'Agencies' && <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>}
                  {item.label === 'Products' && <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>}
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

        {/* Reports */}
        <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-3">Reports</p>
        <div className="flex flex-col gap-2">
          {reportItems.map(item => (
            <button key={item.path} onClick={() => navigate(item.path)}
              className="group bg-white rounded-2xl border border-slate-100 px-4 py-3.5 flex items-center gap-3 shadow-sm hover:shadow-md active:scale-[0.98] transition-all w-full text-left">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: item.color + '15' }}>
                <svg className="w-4 h-4" style={{ color: item.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {item.label === 'Agency Status' && <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>}
                  {item.label === 'Submission History' && <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>}
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

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div className="max-w-lg mx-auto">
          <nav className="bg-white border-t border-slate-100 flex justify-around px-2 py-1">
            {[
              { label:'Dashboard', path:'/super/dashboard', icon:<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg> },
              { label:'Users',     path:'/super/users',     icon:<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg> },
              { label:'Agencies',  path:'/super/agencies',  icon:<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg> },
              { label:'Products',  path:'/super/products',  icon:<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg> },
            ].map(item => {
              const active = window.location.pathname === item.path
              return (
                <button key={item.path} onClick={() => navigate(item.path)}
                  className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${active ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600'}`}>
                  {item.icon}
                  <span className={`text-[10px] font-medium ${active ? 'text-brand-600' : 'text-slate-400'}`}>{item.label}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </div>
    </div>
  )
}
