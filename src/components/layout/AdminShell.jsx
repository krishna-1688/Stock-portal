import { useNavigate } from 'react-router-dom'
import AdminShell from '../../components/layout/AdminShell'
const NAV_ITEMS = [
  { icon: '📊', label: 'Dashboard', path: '/admin/dashboard' },
  { icon: '🏪', label: 'Agencies', path: '/admin/agencies' },
  { icon: '✅', label: 'Status', path: '/admin/status' },
  { icon: '📋', label: 'History', path: '/admin/history' },
]

export default function AdminShell({ children }) {
  const navigate = useNavigate()
  const current = window.location.pathname

  return (
    <AdminShell>
    <div className="min-h-screen bg-[#F5F6FA]">
      {children}
      <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4">
        <div className="max-w-lg mx-auto">
          <nav className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl shadow-black/10 border border-gray-100 flex justify-around py-2 px-2">
            {NAV_ITEMS.map(item => {
              const active = current === item.path
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all duration-200 ${
                    active ? 'bg-brand-600 shadow-lg shadow-brand-600/30' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className={`text-xs font-bold ${active ? 'text-white' : 'text-gray-400'}`}>{item.label}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </div>
    </div>
    </AdminShell>
  )
}