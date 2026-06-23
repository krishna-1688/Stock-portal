import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllAgenciesAdmin } from '../../services/agencyService'
import Spinner from '../../components/ui/Spinner'

// Shared bottom nav items — update here to reflect everywhere
export const ADMIN_NAV = [
  { icon: '📊', label: 'Dashboard', path: '/admin/dashboard' },
  { icon: '🏪', label: 'Agencies',  path: '/admin/agencies' },
  { icon: '✅', label: 'Status',    path: '/admin/status' },
  { icon: '📋', label: 'History',   path: '/admin/history' },
]

export function AdminBottomNav() {
  const navigate = useNavigate()
  const path = window.location.pathname
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4">
      <div className="max-w-lg mx-auto">
        <nav className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl shadow-black/10 border border-gray-100 flex justify-around py-2 px-2">
          {ADMIN_NAV.map(item => {
            const active = path === item.path
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
  )
}

export default function AdminAgencies() {
  const navigate = useNavigate()
  const [agencies, setAgencies] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')

  useEffect(() => {
    getAllAgenciesAdmin()
      .then(data => setAgencies(data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = agencies.filter(a =>
    a.is_active && (!search || a.name.toLowerCase().includes(search.toLowerCase()))
  )

  const waReady  = agencies.filter(a => a.is_active && a.whatsapp_number).length
  const total    = agencies.filter(a => a.is_active).length

  return (
    <div className="min-h-screen bg-[#F5F6FA]">

      {/* Top Bar */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-5 h-16 flex items-center justify-between">
          <div>
            <p className="text-sm font-black text-gray-900 leading-none">Agencies</p>
            <p className="text-xs text-gray-400 leading-none mt-0.5">{total} active · {waReady} WhatsApp ready</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 pb-36">

        {/* Summary banner */}
        <div
          className="relative overflow-hidden rounded-[24px] p-5 mb-5 shadow-lg"
          style={{ background: 'linear-gradient(135deg,#128C7E,#075E54)' }}
        >
          <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-white/5" />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-1">Order via WhatsApp</p>
              <p className="text-white font-black text-xl leading-tight">Select an Agency</p>
              <p className="text-white/60 text-sm mt-1">Tap to view stock & place order</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center text-3xl">🛒</div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            placeholder="Search agencies…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-3">
            <div className="w-14 h-14 rounded-3xl bg-gray-100 flex items-center justify-center text-3xl">🏪</div>
            <p className="text-gray-500 font-medium text-sm">No agencies found.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filtered.map(a => (
              <button
                key={a.id}
                onClick={() => navigate(`/admin/agencies/${a.id}`, { state: { agencyName: a.name } })}
                className="group bg-white rounded-[20px] border border-gray-100 px-4 py-4 flex items-center gap-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95 transition-all duration-200 w-full text-left"
              >
                <div className="w-11 h-11 rounded-2xl bg-brand-50 flex items-center justify-center text-xl shrink-0">🏪</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold text-gray-900 truncate">{a.name}</p>
                  <p className="text-xs mt-0.5">
                    {a.whatsapp_number
                      ? <span className="text-green-600 font-semibold">📱 WhatsApp ready</span>
                      : <span className="text-amber-500 font-semibold">⚠ No WhatsApp number</span>
                    }
                  </p>
                </div>
                <div className="w-8 h-8 rounded-xl bg-gray-50 group-hover:bg-brand-600 flex items-center justify-center transition-colors duration-200 shrink-0">
                  <svg className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <AdminBottomNav />
    </div>
  )
}