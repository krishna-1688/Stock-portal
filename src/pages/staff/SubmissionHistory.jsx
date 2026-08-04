import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageShell from '../../components/layout/PageShell'
import Spinner from '../../components/ui/spinner'
import { getStaffSubmissionHistory } from '../../services/stockService'

export default function SubmissionHistory() {
  const navigate = useNavigate()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getStaffSubmissionHistory().then(d => setHistory(d||[])).catch(console.error).finally(() => setLoading(false))
  }, [])

  const grouped = history.reduce((acc, r) => {
    const date = new Date(r.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
    if (!acc[date]) acc[date] = []
    acc[date].push(r)
    return acc
  }, {})

  return (
    <PageShell>
      <div className="min-h-screen pb-24 bg-slate-50">
        <div className="bg-white border-b border-slate-100 sticky top-0 z-30">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
            <button onClick={() => navigate('/staff/agencies')}
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors shrink-0">
              <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <div>
              <h1 className="text-base font-semibold text-slate-900">Submission History</h1>
              <p className="text-xs text-slate-400">Your past stock entries</p>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 pt-5">
          {loading ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center py-20 gap-3">
              <div className="w-14 h-14 rounded-3xl bg-slate-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
              </div>
              <p className="text-slate-400 text-sm">No submissions yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {Object.entries(grouped).map(([date, records]) => (
                <div key={date}>
                  <div className="flex items-center gap-3 mb-3">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">{date}</p>
                    <div className="flex-1 h-px bg-slate-100" />
                    <span className="text-xs text-slate-400">{records.length}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {records.map(record => (
                      <button key={record.id} onClick={() => navigate(`/staff/history/${record.id}`)}
                        className="group w-full text-left bg-white rounded-2xl px-4 py-3.5 border border-slate-100 shadow-sm hover:shadow-md active:scale-[0.98] transition-all flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2"/></svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{record.agency_name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{record.total_items} items entered</p>
                        </div>
                        <svg className="w-4 h-4 text-slate-300 group-hover:text-brand-600 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  )
}
