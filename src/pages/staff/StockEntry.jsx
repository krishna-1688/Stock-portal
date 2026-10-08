import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { getProductsByAgency } from '../../services/productService'
import { submitStock, getTodaySubmission } from '../../services/stockService'
import Modal from '../../components/ui/modal'
import Button from '../../components/ui/button'
import Spinner from '../../components/ui/spinner'
import PageShell from '../../components/layout/PageShell'
import { loadDraft as loadStoredDraft, saveDraft as saveStoredDraft, clearDraft as clearStoredDraft } from '../../utils/drafts'

const saveDraft  = (id, q) => saveStoredDraft('stock_draft', id, q)
const loadDraft  = (id) => loadStoredDraft('stock_draft', id)
const clearDraft = (id) => clearStoredDraft('stock_draft', id)

function QtyInput({ value, onChange }) {
  return (
    <div className="flex items-center gap-1.5">
      <button onClick={() => onChange(Math.max(0, (value||0) - 1))}
        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-90 transition-all flex items-center justify-center shrink-0">
        <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4"/></svg>
      </button>
      <input type="number" inputMode="numeric" pattern="[0-9]*" min="0"
        value={value === 0 ? '0' : value || ''}
        onChange={e => { const v = e.target.value; if (v === '') { onChange(0); return }; const n = parseInt(v,10); if (!isNaN(n) && n >= 0) onChange(n) }}
        className="w-14 h-8 rounded-lg border border-slate-200 bg-slate-50 text-center text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent focus:bg-white transition-all" />
      <button onClick={() => onChange((value||0) + 1)}
        className="w-8 h-8 rounded-lg bg-brand-600 hover:bg-brand-700 active:scale-90 transition-all flex items-center justify-center shrink-0">
        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
      </button>
    </div>
  )
}

export default function StockEntry() {
  const navigate = useNavigate()
  const { agencyId } = useParams()
  const { state } = useLocation()
  const agencyName = state?.agencyName ?? 'Agency'

  const [products, setProducts] = useState([])
  const [quantities, setQuantities] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [toastType, setToastType] = useState('success')
  const [hasDraft, setHasDraft] = useState(false)
  const [isAlreadySubmitted, setIsAlreadySubmitted] = useState(false)
  const [showDraftPrompt, setShowDraftPrompt] = useState(false)
  const [pendingDraft, setPendingDraft] = useState(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    const load = async () => {
      try {
        const [productData, todayData] = await Promise.all([
          getProductsByAgency(agencyId),
          getTodaySubmission(agencyId).catch(() => [])
        ])
        const prods = productData ?? []
        setProducts(prods)
        const draft = loadDraft(agencyId)
        if (todayData && todayData.length > 0) {
          setIsAlreadySubmitted(true)
          const submittedQtys = {}
          for (const item of todayData) submittedQtys[item.product_id] = item.quantity
          if (draft && Object.keys(draft).length > 0) {
            setPendingDraft(draft); setQuantities(submittedQtys); setShowDraftPrompt(true)
          } else { setQuantities(submittedQtys) }
        } else {
          if (draft && Object.keys(draft).length > 0) { setQuantities(draft); setHasDraft(true) }
        }
      } catch(e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [agencyId])

  const setQty = useCallback((productId, value) => {
    setQuantities(prev => { const updated = { ...prev, [productId]: value }; saveDraft(agencyId, updated); return updated })
  }, [agencyId])

  const showToast = (msg, type = 'success') => { setToastType(type); setToast(msg); setTimeout(() => setToast(''), 3000) }

  const handleSubmit = async () => {
    const items = products.map(p => ({ product_id: p.id, quantity: quantities[p.id] ?? 0 }))
    setSubmitting(true)
    try {
      await submitStock(agencyId, items)
      clearDraft(agencyId)
      setConfirmOpen(false)
      showToast(isAlreadySubmitted ? 'Stock updated.' : 'Stock submitted.')
      setTimeout(() => navigate('/staff/agencies'), 1500)
    } catch(e) { setConfirmOpen(false); showToast('Submit failed: ' + e.message, 'error') }
    finally { setSubmitting(false) }
  }

  const filledCount = products.filter(p => (quantities[p.id] ?? 0) > 0).length
  const totalQty    = Object.values(quantities).reduce((sum, v) => sum + (v||0), 0)
  const pct         = products.length ? Math.round((filledCount / products.length) * 100) : 0

  const filtered = products.filter(p => {
    const ms = !search || p.name?.toLowerCase().includes(search.toLowerCase())
    const mf = filter === 'all' || (filter === 'filled' && (quantities[p.id]??0) > 0) || (filter === 'empty' && !(quantities[p.id]??0) > 0)
    return ms && mf
  })

  return (
    <PageShell>
      <div className="min-h-screen pb-36 bg-slate-50">
        {/* Header */}
        <div className="bg-white border-b border-slate-100 sticky top-0 z-30">
          <div className="max-w-2xl mx-auto px-4 pt-3.5 pb-3">
            <div className="flex items-center gap-3 mb-3">
              <button onClick={() => navigate('/staff/agencies')}
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors shrink-0">
                <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">{isAlreadySubmitted ? 'Update Entry' : 'Stock Entry'}</p>
                <h1 className="text-base font-semibold text-slate-900 leading-tight truncate">{agencyName}</h1>
              </div>
              <div className="flex items-center gap-1.5 bg-brand-50 border border-brand-100 px-2.5 py-1.5 rounded-lg">
                <svg className="w-3 h-3 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                <span className="text-xs font-semibold text-brand-700">{filledCount}/{products.length}</span>
              </div>
            </div>
            {/* progress bar */}
            {!loading && products.length > 0 && (
              <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-brand-600 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 pt-4 flex flex-col gap-3">
          {/* Draft prompt */}
          {showDraftPrompt && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
              <p className="text-sm font-semibold text-amber-800 mb-1">Draft found</p>
              <p className="text-xs text-amber-600 mb-3">You have an unsaved draft. Use it or keep today's submitted values?</p>
              <div className="flex gap-2">
                <button onClick={() => { setQuantities(pendingDraft); setHasDraft(true); setShowDraftPrompt(false) }}
                  className="flex-1 py-2 rounded-xl bg-amber-500 text-white text-xs font-semibold">Use Draft</button>
                <button onClick={() => { clearDraft(agencyId); setPendingDraft(null); setShowDraftPrompt(false) }}
                  className="flex-1 py-2 rounded-xl border border-amber-200 text-amber-700 text-xs font-semibold">Keep Submitted</button>
              </div>
            </div>
          )}

          {isAlreadySubmitted && !showDraftPrompt && (
            <div className="flex items-center gap-3 px-4 py-3 bg-brand-50 border border-brand-100 rounded-2xl">
              <svg className="w-4 h-4 text-brand-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <p className="text-xs text-brand-700 font-medium">Submitted today — change any quantity and resubmit.</p>
            </div>
          )}

          {hasDraft && !isAlreadySubmitted && (
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-100 rounded-2xl">
              <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              <p className="text-xs text-amber-700 font-medium flex-1">Draft restored — your last unsaved entry is loaded.</p>
              <button onClick={() => { clearDraft(agencyId); setHasDraft(false); setQuantities({}) }}
                className="text-xs font-semibold text-red-500">Clear</button>
            </div>
          )}

          {/* Search + filter */}
          {!loading && products.length > 5 && (
            <div className="flex flex-col gap-2">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent"
                  placeholder={`Search ${products.length} products…`} value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="flex gap-2">
                {[['all','All'], ['filled','Filled'], ['empty','Empty']].map(([k,l]) => (
                  <button key={k} onClick={() => setFilter(k)}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${filter === k ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-500'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Product list */}
          {loading ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center py-20 gap-3">
              <div className="w-14 h-14 rounded-3xl bg-slate-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
              </div>
              <p className="text-slate-400 text-sm">No products for this agency.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {filtered.map((product, i) => {
                const qty = quantities[product.id] ?? 0
                const filled = qty > 0
                return (
                  <div key={product.id}
                    className={`flex items-center gap-3 px-4 py-3 ${i !== filtered.length - 1 ? 'border-b border-slate-50' : ''} ${filled ? 'bg-brand-50/30' : ''}`}>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${filled ? 'bg-brand-500' : 'bg-slate-200'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 leading-snug">{product.name}</p>
                      {filled
                        ? <p className="text-xs text-brand-600 mt-0.5">{qty} unit{qty !== 1 ? 's' : ''}</p>
                        : <p className="text-xs text-slate-300 mt-0.5">Not filled</p>
                      }
                    </div>
                    <QtyInput value={qty} onChange={v => setQty(product.id, v)} />
                  </div>
                )
              })}
              {filtered.length === 0 && search && (
                <p className="text-center text-sm text-slate-400 py-8">No products match "{search}"</p>
              )}
            </div>
          )}
        </div>

        {/* Submit bar */}
        {!loading && products.length > 0 && (
          <div className="fixed bottom-16 left-0 right-0 z-30 px-4 pb-2 pt-4"
            style={{ background: 'linear-gradient(to top, #f8fafc 70%, transparent)' }}>
            <div className="max-w-2xl mx-auto">
              <button onClick={() => setConfirmOpen(true)} disabled={submitting}
                className="w-full flex items-center justify-between px-5 py-4 rounded-2xl text-white font-medium text-sm bg-brand-600 hover:bg-brand-700 shadow-lg shadow-brand-600/25 active:scale-[0.98] transition-all">
                <span>{isAlreadySubmitted ? 'Resubmit Stock' : 'Submit Stock'}</span>
                <span className="text-white/70 text-sm">{filledCount}/{products.length} filled</span>
              </button>
            </div>
          </div>
        )}

        {/* Confirm modal */}
        <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title={isAlreadySubmitted ? 'Resubmit stock?' : 'Submit stock?'}>
          <div className="flex flex-col gap-4">
            {isAlreadySubmitted && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                <p className="text-xs text-amber-700">This will add a new submission on top of the existing one. Both saved in history.</p>
              </div>
            )}
            <div className="bg-slate-50 rounded-xl p-4 flex flex-col gap-2">
              <div className="flex justify-between text-sm"><span className="text-slate-400">Agency</span><span className="font-medium text-slate-900">{agencyName}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-400">Products filled</span><span className="font-medium text-slate-900">{filledCount} / {products.length}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-400">Total units</span><span className="font-medium text-slate-900">{totalQty}</span></div>
              {filledCount < products.length && (
                <div className="mt-1 pt-3 border-t border-slate-200">
                  <p className="text-xs text-amber-600">{products.length - filledCount} product{products.length - filledCount > 1 ? 's' : ''} have 0 quantity.</p>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onClick={() => setConfirmOpen(false)} disabled={submitting}>Cancel</Button>
              <Button variant="primary" fullWidth onClick={handleSubmit} loading={submitting}>{isAlreadySubmitted ? 'Resubmit' : 'Confirm'}</Button>
            </div>
          </div>
        </Modal>

        {toast && (
          <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 whitespace-nowrap ${toastType === 'error' ? 'bg-red-600' : 'bg-slate-900'}`}>
            <span>{toastType === 'error' ? '✕' : '✓'}</span>{toast}
          </div>
        )}
      </div>
    </PageShell>
  )
}
