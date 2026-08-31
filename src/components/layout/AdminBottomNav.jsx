import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/authContext'

export default function AdminBottomNav() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const path = window.location.pathname
  const dashboardPath = user?.role === 'super_admin' ? '/super/dashboard' : '/admin/dashboard'
  const ADMIN_NAV = [
    { label: 'Dashboard', path: dashboardPath,   icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg> },
    { label: 'Agencies',  path: '/admin/agencies',  icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path strokeLinecap="round" strokeLinejoin="round" d="M9 22V12h6v10"/></svg> },
    { label: 'Status',    path: '/admin/status',    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
    { label: 'History',   path: '/admin/history',   icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
  ]
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      <div className="max-w-lg mx-auto">
        <nav className="bg-white border-t border-slate-100 flex justify-around px-2 py-1">
          {ADMIN_NAV.map(item => {
            const active = path === item.path
            return (
              <button key={item.path} onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-150 ${active ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600'}`}>
                {item.icon}
                <span className={`text-[10px] font-medium ${active ? 'text-brand-600' : 'text-slate-400'}`}>{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
