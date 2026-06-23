import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/authContext'
import { getSuperAdminCounts } from '../../services/stockService'
import Spinner from '../../components/ui/spinner'

function StatCard({ icon, label, value, from, to, delay = '0ms' }) {
  return (
    <div
      className="relative overflow-hidden rounded-3xl p-5 shadow-lg"
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10" />
      <div className="absolute -right-2 bottom-2 w-16 h-16 rounded-full bg-black/10" />
      <div className="relative">
        <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-xl mb-4 shadow-inner">
          {icon}
        </div>
        <p className="text-3xl font-black text-white tracking-tight">{value ?? '—'}</p>
        <p className="text-white/70 text-xs font-semibold mt-1 uppercase tracking-wider">{label}</p>
      </div>
    </div>
  )
}

function ActionCard({ icon, label, description, onClick, pill, pillColor, iconBg }) {
  return (
    <button
      onClick={onClick}
      className="group relative bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex items-center gap-4 w-full text-left overflow-hidden hover:shadow-xl hover:border-transparent hover:-translate-y-1 active:scale-95 transition-all duration-300"
    >
      {/* Hover glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-brand-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-sm ${iconBg}`}>
        {icon}
      </div>

      <div className="relative flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-bold text-gray-900">{label}</p>
          {pill && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pillColor}`}>
              {pill}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 truncate">{description}</p>
      </div>

      <div className="relative w-9 h-9 rounded-2xl bg-gray-50 group-hover:bg-brand-600 flex items-center justify-center shrink-0 transition-colors duration-300">
        <svg className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  )
}

export default function SuperDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [counts, setCounts] = useState(null)
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  useEffect(() => {
    getSuperAdminCounts()
      .then(data => setCounts(data?.[0]))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-[#F5F6FA]">

      {/* ── Top Bar ── */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-md shadow-brand-500/30">
              <span className="text-white text-sm font-black">S</span>
            </div>
            <div>
              <p className="text-sm font-black text-gray-900 leading-none">Stock Portal</p>
              <p className="text-xs text-gray-400 leading-none mt-0.5">Management System</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-gray-700">{user?.name}</p>
              <p className="text-xs text-brand-600 font-semibold">Super Admin</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-9 h-9 rounded-xl bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors"
              title="Logout"
            >
              <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-32">

        {/* ── Hero ── */}
        <div className="mt-5 mb-6 relative overflow-hidden rounded-[2rem] shadow-2xl shadow-brand-600/25"
          style={{ background: 'linear-gradient(135deg, #15803d 0%, #166534 50%, #14532d 100%)' }}>

          {/* Decorative blobs */}
          <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-white/5" />
          <div className="absolute right-8 -bottom-10 w-32 h-32 rounded-full bg-white/5" />
          <div className="absolute -left-8 bottom-0 w-24 h-24 rounded-full bg-black/10" />

          {/* Grid texture */}
          <div className="absolute inset-0 opacity-5"
            style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

          <div className="relative p-7">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur rounded-full px-3.5 py-1.5">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-white/90 text-xs font-bold tracking-wide">SUPER ADMINISTRATOR</span>
              </div>
              <div className="text-right">
                <p className="text-white/50 text-xs">{dateStr.split(',')[0]}</p>
              </div>
            </div>

            <h1 className="text-3xl font-black text-white leading-tight mb-1">
              {greeting}, <br />
              <span className="text-brand-300">{user?.name?.split(' ')[0]}</span> 👋
            </h1>
            <p className="text-white/50 text-sm mt-3">{dateStr}</p>

            {/* Mini stats strip */}
            {!loading && counts && (
              <div className="mt-5 grid grid-cols-3 gap-2">
                {[
                  { label: 'Admins', value: counts.total_admins },
                  { label: 'Staff', value: counts.total_staff },
                  { label: 'Submissions', value: counts.total_submissions },
                ].map(s => (
                  <div key={s.label} className="bg-white/10 backdrop-blur rounded-2xl p-3 text-center">
                    <p className="text-xl font-black text-white">{s.value}</p>
                    <p className="text-white/60 text-xs font-medium mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Stats Grid ── */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Overview</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mb-7">
            <StatCard icon="👥" label="Admins" value={counts?.total_admins}
              from="#3b82f6" to="#1d4ed8" />
            <StatCard icon="🧑‍💼" label="Staff Members" value={counts?.total_staff}
              from="#8b5cf6" to="#6d28d9" />
            <StatCard icon="🏪" label="Agencies" value={counts?.total_agencies}
              from="#f59e0b" to="#d97706" />
            <StatCard icon="📦" label="Products" value={counts?.total_products}
              from="#16a34a" to="#15803d" />
            <div className="col-span-2 relative overflow-hidden rounded-3xl p-5 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)' }}>
              <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-white/10" />
              <div className="relative flex items-center justify-between">
                <div>
                  <p className="text-white/70 text-xs font-bold uppercase tracking-wider mb-1">All Time</p>
                  <p className="text-4xl font-black text-white">{counts?.total_submissions}</p>
                  <p className="text-white/70 text-xs font-semibold mt-1 uppercase tracking-wider">Stock Submissions</p>
                </div>
                <div className="w-16 h-16 rounded-3xl bg-white/15 backdrop-blur flex items-center justify-center text-4xl shadow-inner">
                  📋
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Management ── */}
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Manage</p>
        <div className="flex flex-col gap-3 mb-7">
          <ActionCard
            icon="👥" label="Manage Users"
            description="Add admins & staff · Reset passwords · Edit roles"
            iconBg="bg-gradient-to-br from-blue-100 to-blue-50"
            pill="Users" pillColor="bg-blue-100 text-blue-600"
            onClick={() => navigate('/super/users')}
          />
          <ActionCard
            icon="🏪" label="Manage Agencies"
            description="Add, edit or archive supplier agencies"
            iconBg="bg-gradient-to-br from-amber-100 to-amber-50"
            pill="Agencies" pillColor="bg-amber-100 text-amber-600"
            onClick={() => navigate('/super/agencies')}
          />
          <ActionCard
            icon="📦" label="Manage Products"
            description="Add products and assign them to agencies"
            iconBg="bg-gradient-to-br from-green-100 to-green-50"
            pill="Products" pillColor="bg-green-100 text-green-700"
            onClick={() => navigate('/super/products')}
          />
        </div>

        {/* ── Reports ── */}
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Reports</p>
        <div className="flex flex-col gap-3">
          <ActionCard
            icon="✅" label="Agency Status"
            description="See which agencies are updated or pending"
            iconBg="bg-gradient-to-br from-emerald-100 to-green-50"
            onClick={() => navigate('/admin/status')}
          />
          <ActionCard
            icon="📊" label="Submission History"
            description="View and browse all past stock submissions"
            iconBg="bg-gradient-to-br from-purple-100 to-purple-50"
            onClick={() => navigate('/admin/history')}
          />
        </div>

      </div>

      {/* ── Bottom Nav ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4">
        <div className="max-w-lg mx-auto">
          <nav className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl shadow-black/10 border border-gray-100 flex justify-around py-2 px-2">
            {[
              { icon: '📊', label: 'Home', path: '/super/dashboard' },
              { icon: '👥', label: 'Users', path: '/super/users' },
              { icon: '🏪', label: 'Agencies', path: '/super/agencies' },
              { icon: '📦', label: 'Products', path: '/super/products' },
            ].map(item => {
              const active = window.location.pathname === item.path
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all duration-200 ${
                    active
                      ? 'bg-brand-600 shadow-lg shadow-brand-600/30'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className={`text-xs font-bold ${active ? 'text-white' : 'text-gray-400'}`}>
                    {item.label}
                  </span>
                </button>
              )
            })}
          </nav>
        </div>
      </div>

    </div>
  )
}