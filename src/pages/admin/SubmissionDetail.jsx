import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getSubmissionDetail } from '../../services/stockService'
import Spinner from '../../components/ui/spinner'

export default function SubmissionDetail() {
  const { submissionId } = useParams()
  const navigate = useNavigate()
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getSubmissionDetail(submissionId)
      .then(data => {
        if (!data || data.length === 0) { setError('Submission not found.'); return }
        setDetail({ agency_name: data[0].agency_name, submitted_by_name: data[0].submitted_by_name, submitted_at: data[0].submitted_at, items: data.map(r => ({ product_name: r.product_name, quantity: r.quantity })) })
      })
      .catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [submissionId])

  const dateStr = detail?.submitted_at ? new Date(detail.submitted_at).toLocaleDateString('en-IN', {weekday:'long',day:'numeric',month:'long',year:'numeric'}) : ''
  const timeStr = detail?.submitted_at ? new Date(detail.submitted_at).toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'}) : ''
  const totalQty = detail?.items?.reduce((sum,i) => sum + (i.quantity??0), 0) ?? 0

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
            <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <div>
            <p className="text-base font-semibold text-slate-900">Submission detail</p>
            <p className="text-xs text-slate-400">{detail?.agency_name ?? '...'}</p>
          </div>
        </div>
      </div>
      <div className="max-w-lg mx-auto px-4 pb-16 pt-5">
        {loading ? <div className="flex justify-center py-20"><Spinner /></div>
        : error ? (
          <div className="flex flex-col items-center py-20 gap-3">
            <div className="w-14 h-14 rounded-3xl bg-red-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            </div>
            <p className="text-red-500 text-sm">{error}</p>
            <button onClick={() => navigate(-1)} className="px-5 py-2.5 rounded-2xl bg-brand-600 text-white text-sm font-medium">Go Back</button>
          </div>
        ) : (
          <>
            {/* Meta */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[{v:detail?.items?.length??0,l:'Products'},{v:totalQty,l:'Total units'},{v:timeStr,l:'Time'}].map(s => (
                <div key={s.l} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm text-center">
                  <p className="text-xl font-semibold text-slate-900">{s.v}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{s.l}</p>
                </div>
              ))}
            </div>
            {/* Submitted by */}
            <div className="bg-white rounded-2xl border border-slate-100 px-4 py-3.5 flex items-center gap-3 mb-4 shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
              </div>
              <div>
                <p className="text-xs text-slate-400">Submitted by</p>
                <p className="text-sm font-medium text-slate-900">{detail?.submitted_by_name}</p>
                <p className="text-xs text-slate-400">{dateStr} at {timeStr}</p>
              </div>
            </div>
            {/* Items */}
            <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-3">Stock items ({detail?.items?.length ?? 0})</p>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {(detail?.items ?? []).map((item, i) => (
                <div key={i} className={`flex items-center justify-between px-4 py-3 ${i !== (detail?.items?.length??0)-1 ? 'border-b border-slate-50' : ''}`}>
                  <p className="text-sm text-slate-900 flex-1 min-w-0 pr-4">{item.product_name}</p>
                  <div className="text-right shrink-0">
                    <p className="text-base font-semibold text-brand-600">{item.quantity}</p>
                    <p className="text-xs text-slate-400">units</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
