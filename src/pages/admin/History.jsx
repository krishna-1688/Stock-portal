import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRecentSubmissions } from '../../services/stockService'
import { getActiveAgencies } from '../../services/agencyService'
import Spinner from '../../components/ui/spinner'
import AdminBottomNav from '../../components/layout/AdminBottomNav'

export default function History() {
  const navigate = useNavigate()
  const [submissions, setSubmissions] = useState([])
  const [agencies, setAgencies]       = useState([])
  const [selectedAgency, setSelectedAgency] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getRecentSubmissions(50), getActiveAgencies()])
      .then(([subs, ags]) => { setSubmissions(subs ?? []); setAgencies(ags ?? []) })
      .catch(console.error).finally(() => setLoading(false))
  }, [])

  const filtered = selectedAgency === 'all' ? submissions : submissions.filter(s => s.agency_name === selectedAgency)
  const grouped  = filtered.reduce((acc, sub) => {
    const date = new Date(sub.submitted_at).toLocaleDateString('en-IN', {weekday:'short',day:'numeric',month:'short',year:'numeric'})
    if (!acc[date]) acc[date] = []
    acc[date].push(sub)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
            <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <div>
            <h1 className="text-base font-semibold text-slate-900">Submission History</h1>
            <p className="text-xs text-slate-400">{submissions.length} total records</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-28 pt-4">
        {/* Agency filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4" style={{scrollbarWidth:'none'}}>
          <button onClick={() => setSelectedAgency('all')}
            className={`shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-all ${selectedAgency==='all' ? 'bg-brand-600 text-white' : 'bg-white text-slate-500 border border-slate-100 hover:border-slate-200'}`}>
            All
          </button>
          {agencies.map(a => (
            <button key={a.id} onClick={() => setSelectedAgency(a.name)}
              className={`shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-all ${selectedAgency===a.name ? 'bg-brand-600 text-white' : 'bg-white text-slate-500 border border-slate-100 hover:border-slate-200'}`}>
              {a.name}
            </button>
          ))}
        </div>

        {loading ? <div className="flex justify-center py-16"><Spinner /></div>
        : Object.keys(grouped).length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-3">
            <div className="w-14 h-14 rounded-3xl bg-slate-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2"/></svg>
            </div>
            <p className="text-slate-400 text-sm">No submissions found.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {Object.entries(grouped).map(([date, subs]) => (
              <div key={date}>
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">{date}</p>
                  <div className="flex-1 h-px bg-slate-100" />
                  <span className="text-xs text-slate-400">{subs.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {subs.map(sub => {
                    const timeStr = new Date(sub.submitted_at).toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'})
                    return (
                      <button key={sub.submission_id} onClick={() => navigate(`/admin/history/${sub.submission_id}`)}
                        className="group bg-white rounded-2xl border border-slate-100 px-4 py-3.5 flex items-center gap-3 shadow-sm hover:shadow-md active:scale-[0.98] transition-all w-full text-left">
                        <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2"/></svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{sub.agency_name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{timeStr} · {sub.submitted_by_name}</p>
                        </div>
                        <svg className="w-4 h-4 text-slate-300 group-hover:text-brand-600 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <AdminBottomNav />
    </div>
  )
}
