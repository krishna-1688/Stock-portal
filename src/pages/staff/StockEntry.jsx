import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { getProductsByAgency } from '../../services/productService'
import { submitStock, getTodaySubmission } from '../../services/stockService'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import PageShell from '../../components/layout/PageShell'

const DRAFT_KEY = (agencyId) => `stock_draft_${agencyId}`

function saveDraft(agencyId, quantities) {
  localStorage.setItem(DRAFT_KEY(agencyId), JSON.stringify(quantities))
}

function loadDraft(agencyId) {
  try {
    const raw = localStorage.getItem(DRAFT_KEY(agencyId))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function clearDraft(agencyId) {
  localStorage.removeItem(DRAFT_KEY(agencyId))
}

function QtyInput({ value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(Math.max(0, (value || 0) - 1))}
        className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 active:scale-90 transition-all flex items-center justify-center shrink-0"
      >
        <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
        </svg>
      </button>
      <input
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        min="0"
        value={value === 0 ? '0' : value || ''}
        onChange={e => {
          const v = e.target.value
          if (v === '') { onChange(0); return }
          const n = parseInt(v, 10)
          if (!isNaN(n) && n >= 0) onChange(n)
        }}
        className="w-16 h-9 rounded-xl border border-gray-200 bg-gray-50 text-center text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent focus:bg-white transition-all"
      />
      <button
        onClick={() => onChange((value || 0) + 1)}
        className="w-9 h-9 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-90 transition-all flex items-center justify-center shrink-0"
      >
        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
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

  // draft / prefill state
  const [hasDraft, setHasDraft] = useState(false)
  const [isAlreadySubmitted, setIsAlreadySubmitted] = useState(false)
  const [showDraftPrompt, setShowDraftPrompt] = useState(false)
  const [pendingDraft, setPendingDraft] = useState(null)

  const [search, setSearch] = useState('')

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
          // Already submitted today — pre-fill with submitted values
          setIsAlreadySubmitted(true)
          const submittedQtys = {}
          for (const item of todayData) {
            submittedQtys[item.product_id] = item.quantity
          }

          if (draft && Object.keys(draft).length > 0) {
            // Both draft and today's submission exist — ask user
            setPendingDraft(draft)
            setQuantities(submittedQtys)
            setShowDraftPrompt(true)
          } else {
            setQuantities(submittedQtys)
          }
        } else {
          // Not submitted today — check for draft
          if (draft && Object.keys(draft).length > 0) {
            setQuantities(draft)
            setHasDraft(true)
          }
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [agencyId])

  const setQty = useCallback((productId, value) => {
    setQuantities(prev => {
      const updated = { ...prev, [productId]: value }
      saveDraft(agencyId, updated)
      return updated
    })
  }, [agencyId])

  const showToast = (msg, type = 'success') => {
    setToastType(type)
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const handleSubmit = async () => {
    const items = products.map(p => ({
      product_id: p.id,
      quantity: quantities[p.id] ?? 0,
    }))
    setSubmitting(true)
    try {
      await submitStock(agencyId, items)
      clearDraft(agencyId)
      setConfirmOpen(false)
      showToast(isAlreadySubmitted ? 'Stock updated successfully!' : 'Stock submitted successfully!')
      setTimeout(() => navigate('/staff/agencies'), 1500)
    } catch (e) {
      setConfirmOpen(false)
      showToast('Submit failed: ' + e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClearDraft = () => {
    clearDraft(agencyId)
    setHasDraft(false)
    setQuantities({})
  }

  const filledCount = products.filter(p => (quantities[p.id] ?? 0) > 0).length
  const totalQty = Object.values(quantities).reduce((sum, v) => sum + (v || 0), 0)
  const filtered = products.filter(p =>
    !search || p.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <PageShell>
      <div className="min-h-screen pb-36" style={{ background: '#f8fafc' }}>

        {/* Header */}
        <div className="bg-white sticky top-0 z-30" style={{ borderBottom: '1px solid #f1f5f9' }}>
          <div className="max-w-2xl mx-auto px-4 pt-4 pb-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/staff/agencies')}
                className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors shrink-0"
              >
                <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  {isAlreadySubmitted ? 'Update Entry' : 'Stock Entry'}
                </p>
                <h1 className="text-lg font-black text-gray-900 leading-tight truncate">{agencyName}</h1>
              </div>
              {hasDraft && !isAlreadySubmitted && (
                <button
                  onClick={handleClearDraft}
                  className="text-xs font-semibold text-red-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 pt-4 flex flex-col gap-4">

          {/* Draft prompt — only when draft exists on top of today's submission */}
          {showDraftPrompt && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-sm font-bold text-amber-800 mb-1">📝 Unsaved draft found</p>
              <p className="text-xs text-amber-600 mb-3">
                You have an unsaved draft. Do you want to use it, or keep today's submitted values?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setQuantities(pendingDraft)
                    setHasDraft(true)
                    setShowDraftPrompt(false)
                  }}
                  className="flex-1 py-2 rounded-xl bg-amber-500 text-white text-xs font-bold"
                >
                  Use Draft
                </button>
                <button
                  onClick={() => {
                    clearDraft(agencyId)
                    setPendingDraft(null)
                    setShowDraftPrompt(false)
                  }}
                  className="flex-1 py-2 rounded-xl bg-white border border-amber-200 text-amber-700 text-xs font-bold"
                >
                  Keep Submitted
                </button>
              </div>
            </div>
          )}

          {/* Already submitted banner */}
          {isAlreadySubmitted && !showDraftPrompt && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border"
              style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
              <span className="text-lg">✅</span>
              <div>
                <p className="text-sm font-bold text-brand-700">Submitted today</p>
                <p className="text-xs text-brand-600">Showing today's values. Change any quantity and resubmit.</p>
              </div>
            </div>
          )}

          {/* Draft banner */}
          {hasDraft && !isAlreadySubmitted && (
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 rounded-2xl border border-amber-100">
              <span className="text-lg">📝</span>
              <p className="text-sm font-semibold text-amber-700">Draft restored — your last unsaved entry is loaded.</p>
            </div>
          )}

          {/* Progress strip */}
          {!loading && products.length > 0 && (
            <div className="relative overflow-hidden rounded-[24px] p-5"
              style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)' }}>
              <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-white/5" />
              <div className="absolute -right-4 bottom-0 w-20 h-20 rounded-full bg-white/5" />
              <div className="relative flex items-center justify-between">
                <div>
                  <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-1">{agencyName}</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-black text-white">{filledCount}</span>
                    <span className="text-white/40 text-xl font-bold">/{products.length} filled</span>
                  </div>
                  <p className="text-white/50 text-xs mt-1">{totalQty} total units</p>
                </div>
                <div className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <span className="text-2xl font-black text-white">
                    {products.length ? Math.round((filledCount / products.length) * 100) : 0}%
                  </span>
                </div>
              </div>
              <div className="relative w-full rounded-full overflow-hidden mt-4"
                style={{ height: 5, background: 'rgba(255,255,255,0.12)' }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${products.length ? (filledCount / products.length) * 100 : 0}%`,
                    background: 'linear-gradient(90deg, #4ade80, #16a34a)'
                  }} />
              </div>
            </div>
          )}

          {/* Search */}
          {!loading && products.length > 5 && (
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Search products…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          )}

          {/* Product list */}
          {loading ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center py-20 gap-3">
              <div className="w-16 h-16 rounded-3xl bg-gray-100 flex items-center justify-center text-3xl">📦</div>
              <p className="text-gray-500 font-medium text-sm">No products for this agency.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((product, i) => {
                const qty = quantities[product.id] ?? 0
                const filled = qty > 0
                return (
                  <div key={product.id}
                    className="bg-white rounded-2xl border transition-all duration-150"
                    style={{ borderColor: filled ? '#bbf7d0' : '#f1f5f9' }}>
                    <div className="flex items-center gap-4 px-4 py-3.5">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0 transition-all duration-200"
                        style={{
                          background: filled ? 'linear-gradient(135deg,#16a34a,#15803d)' : '#f8fafc',
                          color: filled ? '#fff' : '#94a3b8'
                        }}>
                        {filled ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{product.name}</p>
                        {filled && (
                          <p className="text-xs text-brand-600 font-semibold mt-0.5">{qty} unit{qty !== 1 ? 's' : ''}</p>
                        )}
                      </div>
                      <QtyInput value={qty} onChange={v => setQty(product.id, v)} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {filtered.length === 0 && search && (
            <div className="text-center py-8 text-sm text-gray-400">No products match "{search}"</div>
          )}
        </div>

        {/* Submit bar */}
        {!loading && products.length > 0 && (
          <div className="fixed bottom-16 left-0 right-0 z-30 px-4 pb-2 pt-3"
            style={{ background: 'linear-gradient(to top, #f8fafc 80%, transparent)' }}>
            <div className="max-w-2xl mx-auto">
              <button
                onClick={() => setConfirmOpen(true)}
                disabled={submitting}
                className="w-full flex items-center justify-between px-6 py-4 rounded-2xl text-white font-black text-base shadow-lg active:scale-95 transition-all duration-150"
                style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 8px 24px rgba(22,163,74,0.35)' }}
              >
                <span>{isAlreadySubmitted ? 'Resubmit Stock' : 'Submit Stock'}</span>
                <div className="flex items-center gap-3">
                  <span className="text-white/70 text-sm font-semibold">{filledCount}/{products.length}</span>
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Confirm modal */}
        <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)}
          title={isAlreadySubmitted ? 'Resubmit Stock?' : 'Submit Stock?'}>
          <div className="flex flex-col gap-4">
            {isAlreadySubmitted && (
              <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
                <p className="text-xs font-semibold text-amber-700">
                  ⚠️ This will add a new submission for today on top of the existing one. Both will be saved in history.
                </p>
              </div>
            )}
            <div className="bg-gray-50 rounded-2xl p-4 flex flex-col gap-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 font-medium">Agency</span>
                <span className="font-bold text-gray-900">{agencyName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 font-medium">Products filled</span>
                <span className="font-bold text-gray-900">{filledCount} / {products.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 font-medium">Total units</span>
                <span className="font-bold text-gray-900">{totalQty}</span>
              </div>
              {filledCount < products.length && (
                <div className="mt-1 pt-3 border-t border-gray-200">
                  <p className="text-xs text-amber-600 font-semibold">
                    ⚠️ {products.length - filledCount} product{products.length - filledCount > 1 ? 's' : ''} have 0 quantity.
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onClick={() => setConfirmOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button variant="primary" fullWidth onClick={handleSubmit} loading={submitting}>
                {isAlreadySubmitted ? 'Resubmit' : 'Confirm Submit'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Toast */}
        {toast && (
          <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 whitespace-nowrap ${toastType === 'error' ? 'bg-red-600' : 'bg-gray-900'}`}>
            <span className={toastType === 'error' ? 'text-red-200' : 'text-brand-400'}>
              {toastType === 'error' ? '✕' : '✓'}
            </span>
            {toast}
          </div>
        )}
      </div>
    </PageShell>
  )
}