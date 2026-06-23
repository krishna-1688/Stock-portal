import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getRecentSubmissions } from '../../services/stockService'
import { getActiveAgencies } from '../../services/agencyService'
import Spinner from '../../components/ui/Spinner'

export default function History() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [submissions, setSubmissions] = useState([])
  const [agencies, setAgencies] = useState([])
  const [selectedAgency, setSelectedAgency] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [subs, ags] = await Promise.all([getRecentSubmissions(50), getActiveAgencies()])
        setSubmissions(subs ?? [])
        setAgencies(ags ?? [])
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleLogout = async () => { await logout(); navigate('/login') }

  const filtered = selectedAgency === 'all'
    ? submissions
    : submissions.filter(s => s.agency_name === selectedAgency)

  const grouped = filtered.reduce((acc, sub) => {
    const date = new Date(sub.submitted_at).toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    })
    if (!acc[date]) acc[date] = []
    acc[date].push(sub)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-[#F5F6FA]">

      {/* Top Bar */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <p className="text-sm font-black text-gray-900 leading-none">Submission History</p>
              <p className="text-xs text-gray-400 leading-none mt-0.5">{submissions.length} total records</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-9 h-9 rounded-xl bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
            </svg>
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-32 pt-5">

        {/* Agency Filter */}
        <div className="mb-5">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Filter by Agency</p>
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            <button
              onClick={() => setSelectedAgency('all')}
              className={`shrink-0 px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
                selectedAgency === 'all'
                  ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30'
                  : 'bg-white text-gray-500 border border-gray-100'
              }`}
            >
              All Agencies
            </button>
            {agencies.map(a => (
              <button
                key={a.id}
                onClick={() => setSelectedAgency(a.name)}
                className={`shrink-0 px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
                  selectedAgency === a.name
                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30'
                    : 'bg-white text-gray-500 border border-gray-100'
                }`}
              >
                {a.name}
              </button>
            ))}
          </div>
        </div>

        {/* Submissions grouped by date */}
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-3">
            <div className="w-14 h-14 rounded-3xl bg-gray-100 flex items-center justify-center text-3xl">📋</div>
            <p className="text-gray-500 font-medium text-sm">No submissions found.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {Object.entries(grouped).map(([date, subs]) => (
              <div key={date}>
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{date}</p>
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs font-bold text-gray-400">{subs.length}</span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {subs.map(sub => {
                    const timeStr = new Date(sub.submitted_at).toLocaleTimeString('en-IN', {
                      hour: '2-digit', minute: '2-digit'
                    })
                    return (
                      <button
                        key={sub.submission_id}
                        onClick={() => navigate(`/admin/history/${sub.submission_id}`)}
                        className="group bg-white rounded-[20px] border border-gray-100 px-4 py-4 flex items-center gap-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95 transition-all duration-200 w-full text-left"
                      >
                        <div className="w-11 h-11 rounded-2xl bg-purple-50 flex items-center justify-center shrink-0 text-lg">
                          📋
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-bold text-gray-900 truncate">{sub.agency_name}</p>
                          <p className="text-xs text-gray-400 font-medium mt-0.5">
                            {timeStr} · by {sub.submitted_by_name}
                          </p>
                        </div>
                        <svg
                          className="w-4 h-4 text-gray-300 group-hover:text-brand-600 transition-colors shrink-0"
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
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
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex flex-col items-center gap-1 px-5 py-2 rounded-2xl transition-all duration-200 ${
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
  )
}