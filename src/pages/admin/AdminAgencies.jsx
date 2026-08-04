import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllAgenciesAdmin } from '../../services/agencyService'
import Spinner from '../../components/ui/spinner'
import AdminBottomNav from '../../components/layout/AdminBottomNav'

const PALETTE = ['#1B5E37','#2563EB','#7C3AED','#D97706','#0891B2','#DC2626','#0D9488']
function initials(name) { return name.split(' ').slice(0,2).map(w=>w[0]?.toUpperCase()??'').join('') }

export default function AdminAgencies() {
  const navigate = useNavigate()
  const [agencies, setAgencies] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    getAllAgenciesAdmin().then(d => setAgencies(d ?? [])).catch(console.error).finally(() => setLoading(false))
  }, [])

  const filtered = agencies.filter(a => a.is_active && (!search || a.name.toLowerCase().includes(search.toLowerCase())))

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors shrink-0">
            <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <div>
            <h1 className="text-base font-semibold text-slate-900">Reorder Stock</h1>
            <p className="text-xs text-slate-400">Select agency to place order</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 pb-28">
        <div className="relative mb-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent"
            placeholder="Search agencies…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {loading ? <div className="flex justify-center py-20"><Spinner /></div>
        : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-3">
            <div className="w-14 h-14 rounded-3xl bg-slate-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
            </div>
            <p className="text-slate-400 text-sm">No agencies found.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((a, i) => (
              <button key={a.id} onClick={() => navigate(`/admin/agencies/${a.id}`, { state: { agencyName: a.name } })}
                className="group bg-white rounded-2xl border border-slate-100 px-4 py-3.5 flex items-center gap-3 shadow-sm hover:shadow-md active:scale-[0.98] transition-all w-full text-left">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-semibold shrink-0" style={{ background: PALETTE[i % PALETTE.length] }}>
                  {initials(a.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{a.name}</p>
                  <p className="text-xs mt-0.5">
                    {a.whatsapp_number
                      ? <span className="text-brand-600 font-medium">WhatsApp ready</span>
                      : <span className="text-amber-500">No WhatsApp number</span>}
                  </p>
                </div>
                <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              </button>
            ))}
          </div>
        )}
      </div>
      <AdminBottomNav />
    </div>
  )
}
