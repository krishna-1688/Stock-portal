import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAgencyStatus } from '../../services/stockService'
import Spinner from '../../components/ui/spinner'
import AdminBottomNav from '../../components/layout/AdminBottomNav'

export default function AgencyStatus() {
  const navigate = useNavigate()
  const [statusList, setStatusList] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    getAgencyStatus().then(d => setStatusList(d ?? [])).catch(console.error).finally(() => setLoading(false))
  }, [])

  const submitted = statusList.filter(s => s.status === 'Updated')
  const pending   = statusList.filter(s => s.status === 'Pending')
  const pct       = statusList.length ? Math.round((submitted.length / statusList.length) * 100) : 0
  const filtered  = filter === 'submitted' ? submitted : filter === 'pending' ? pending : statusList

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
            <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <div>
            <h1 className="text-base font-semibold text-slate-900">Agency Status</h1>
            <p className="text-xs text-slate-400">{new Date().toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'})}</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-28 pt-5">
        {/* Progress */}
        {!loading && statusList.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-slate-400 mb-1">Today's coverage</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-semibold text-slate-900">{submitted.length}</span>
                  <span className="text-slate-300 text-lg font-medium">/{statusList.length}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{pct === 100 ? 'All agencies submitted' : `${pending.length} still pending`}</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                <span className="text-lg font-semibold text-slate-900">{pct}%</span>
              </div>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-brand-600 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 mb-4">
          {[['all',`All (${statusList.length})`],['submitted',`Done (${submitted.length})`],['pending',`Pending (${pending.length})`]].map(([k,l]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all ${filter===k ? 'bg-brand-600 text-white' : 'bg-white text-slate-500 border border-slate-100 hover:border-slate-200'}`}>
              {l}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? <div className="flex justify-center py-16"><Spinner /></div> : (
          <div className="flex flex-col gap-2">
            {filtered.map(agency => {
              const isUpdated = agency.status === 'Updated'
              return (
                <div key={agency.agency_id}
                  className="bg-white rounded-2xl border border-slate-100 px-4 py-3.5 flex items-center gap-3 shadow-sm">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isUpdated ? 'bg-brand-50' : 'bg-amber-50'}`}>
                    <svg className={`w-4 h-4 ${isUpdated ? 'text-brand-600' : 'text-amber-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      {isUpdated
                        ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        : <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>}
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{agency.agency_name}</p>
                    {isUpdated && agency.last_updated_at && (
                      <p className="text-xs text-brand-600 mt-0.5">
                        {new Date(agency.last_updated_at).toLocaleString('en-IN', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                      </p>
                    )}
                    {!isUpdated && <p className="text-xs text-amber-500 mt-0.5">Not submitted yet</p>}
                  </div>
                  <button onClick={() => navigate(`/admin/agencies/${agency.agency_id}`, {state:{agencyName:agency.agency_name}})}
                    className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center transition-colors shrink-0">
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                  </button>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <div className="flex flex-col items-center py-16 gap-3">
                <div className="w-14 h-14 rounded-3xl bg-slate-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
                </div>
                <p className="text-slate-400 text-sm">No agencies found.</p>
              </div>
            )}
          </div>
        )}
      </div>
      <AdminBottomNav />
    </div>
  )
}
