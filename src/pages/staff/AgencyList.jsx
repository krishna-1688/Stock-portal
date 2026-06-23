import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getActiveAgencies } from '../../services/agencyService'
import Spinner from '../../components/ui/Spinner'
import PageShell from '../../components/layout/PageShell'

const GRADIENTS = [
  { from: '#16a34a', to: '#15803d', light: '#f0fdf4', text: '#15803d' },
  { from: '#0284c7', to: '#0369a1', light: '#eff6ff', text: '#0369a1' },
  { from: '#7c3aed', to: '#6d28d9', light: '#f5f3ff', text: '#6d28d9' },
  { from: '#db2777', to: '#be185d', light: '#fdf2f8', text: '#be185d' },
  { from: '#d97706', to: '#b45309', light: '#fffbeb', text: '#b45309' },
  { from: '#0891b2', to: '#0e7490', light: '#ecfeff', text: '#0e7490' },
  { from: '#dc2626', to: '#b91c1c', light: '#fef2f2', text: '#b91c1c' },
]

function AgencyCard({ agency, index, onClick }) {
  const g = GRADIENTS[index % GRADIENTS.length]
  const initials = agency.name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')

  return (
    <button
      onClick={onClick}
      className="group relative bg-white w-full text-left active:scale-95 transition-all duration-150"
      style={{ borderRadius: 20 }}
    >
      <div className="absolute inset-0 rounded-[20px] shadow-sm group-hover:shadow-md transition-shadow duration-300" />

      <div className="relative flex items-center gap-4 px-4 py-4 rounded-[20px] border border-gray-100 group-hover:border-gray-200 transition-colors overflow-hidden">
        {/* left color strip */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ background: `linear-gradient(180deg, ${g.from}, ${g.to})`, borderRadius: '20px 0 0 20px' }}
        />

        {/* avatar */}
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-sm shrink-0 ml-2 shadow-sm"
          style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
        >
          {initials}
        </div>

        {/* main content */}
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-bold text-gray-900 leading-tight truncate">{agency.name}</p>
          <p className="text-xs text-gray-500 font-medium mt-1">Tap to enter stock</p>
        </div>

        {/* right arrow icon */}
        <div className="shrink-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gray-50 text-gray-400 group-hover:bg-gray-100 group-hover:text-gray-600 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </button>
  )
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
    const load = async () => {
      try {
        const agencyData = await getActiveAgencies()
        setAgencies(agencyData ?? [])
      } catch (e) {
        console.error('agencies error', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <PageShell>
      <div className="min-h-screen pb-28" style={{ background: '#f8fafc' }}>
        
        {/* ── top header ── */}
        <div className="bg-white sticky top-0 z-30 shadow-sm">
          <div className="max-w-2xl mx-auto px-4 pt-4 pb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{dateStr}</p>
              <h1 className="text-xl font-black text-gray-900 mt-0.5">
                Good {greeting}, {firstName} 👋
              </h1>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 hover:bg-red-50 transition-colors text-gray-600 hover:text-red-600 text-xs font-semibold"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 pt-6 flex flex-col gap-6">

          {/* ── Action Buttons ── */}
          {!loading && (
            <button 
              onClick={() => navigate('/staff/history')}
              className="w-full bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between shadow-sm active:scale-95 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-gray-900">Submission History</p>
                  <p className="text-xs text-gray-500">View your past stock entries</p>
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* ── Agency List ── */}
          {!loading && agencies.length > 0 && (
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest px-1 mb-3">
                Select Agency
              </p>
              <div className="flex flex-col gap-3">
                {agencies.map((agency, i) => (
                  <AgencyCard
                    key={agency.id}
                    agency={agency}
                    index={i}
                    onClick={() => navigate(`/staff/agencies/${agency.id}`, { state: { agencyName: agency.name } })}
                  />
                ))}
              </div>
            </div>
          )}

          {/* loading */}
          {loading && (
            <div className="flex justify-center py-16"><Spinner /></div>
          )}

          {/* empty */}
          {!loading && agencies.length === 0 && (
            <div className="flex flex-col items-center py-20 gap-3">
              <div className="w-16 h-16 rounded-3xl bg-gray-100 flex items-center justify-center text-3xl">🏪</div>
              <p className="text-gray-500 font-medium text-sm">No active agencies found.</p>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  )
}