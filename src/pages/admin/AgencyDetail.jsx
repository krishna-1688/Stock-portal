import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { getProductsByAgency } from '../../services/productService'
import { getAllAgenciesAdmin } from '../../services/agencyService'
import { getAgencyProductsWithQty } from '../../services/stockService'
import Spinner from '../../components/ui/spinner'
import AdminBottomNav from '../../components/layout/AdminBottomNav'

const UNITS = ['pcs','carton','dozen','half dozen','kg','gm','litre','ml','pack','box','bag']
const ORDER_KEY  = id => `order_draft_${id}`
const saveOrder  = (id, o) => localStorage.setItem(ORDER_KEY(id), JSON.stringify(o))
const loadOrder  = id => { try { const r = localStorage.getItem(ORDER_KEY(id)); return r ? JSON.parse(r) : {} } catch { return {} } }
const clearOrder = id => localStorage.removeItem(ORDER_KEY(id))

function ProductRow({ product, stockQty, order, onChange }) {
  const qty  = order?.qty  ?? 0
  const unit = order?.unit ?? 'pcs'
  const setQty  = val => { const n = Math.max(0, Math.min(9999, Number(val)||0)); onChange(product.id, { qty: n, unit }) }
  const setUnit = u   => onChange(product.id, { qty, unit: u })
  const isOrdered = qty > 0
  const hasStock  = stockQty !== null && stockQty !== undefined
  const stockVal  = hasStock ? stockQty : '—'

  return (
    <div className={`flex items-center px-4 py-3 gap-3 border-b border-slate-50 last:border-0 ${isOrdered ? 'bg-brand-50/40' : ''}`}>
      <div className={`font-medium text-xs min-w-[28px] text-center py-1 px-1.5 rounded-md ${
        hasStock && stockQty === 0 ? 'bg-red-100 text-red-700' :
        hasStock && stockQty <= 5 ? 'bg-amber-100 text-amber-700' :
        'bg-slate-100 text-slate-600'
      }`}>{stockVal}</div>
      <p className="text-sm text-slate-900 flex-1 min-w-0 leading-snug">{product.name}</p>
      <div className="flex items-center gap-1.5 shrink-0">
        <button onClick={() => setQty(qty-1)} disabled={qty===0}
          className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold transition-all active:scale-90 ${qty===0 ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>−</button>
        <input type="number" min={0} max={9999} value={qty===0?'':qty} placeholder="0" onChange={e=>setQty(e.target.value)}
          className={`w-12 h-7 rounded-lg border text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-600 transition-all ${isOrdered ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-slate-200 bg-slate-50 text-slate-700'}`} />
        <button onClick={() => setQty(qty+1)}
          className="w-7 h-7 rounded-lg bg-brand-600 hover:bg-brand-700 text-white flex items-center justify-center text-sm font-bold transition-all active:scale-90">+</button>
        <select value={unit} onChange={e=>setUnit(e.target.value)}
          className={`h-7 px-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${isOrdered ? 'bg-brand-600 text-white border-brand-600' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
          {UNITS.map(u=><option key={u} value={u}>{u}</option>)}
        </select>
      </div>
    </div>
  )
}

export default function AgencyDetail() {
  const { agencyId } = useParams()
  const navigate     = useNavigate()
  const location     = useLocation()
  const [products, setProducts] = useState([])
  const [stockMap, setStockMap] = useState({})
  const [agency, setAgency]     = useState(null)
  const [loading, setLoading]   = useState(true)
  const [order, setOrder]       = useState({})
  const [toast, setToast]       = useState('')
  const [search, setSearch]     = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const agencyNameFromState = location.state?.agencyName

  useEffect(() => {
    Promise.all([getProductsByAgency(agencyId), getAllAgenciesAdmin(), getAgencyProductsWithQty(agencyId).catch(()=>[])])
      .then(([prods, agencies, stockRows]) => {
        setProducts(prods ?? [])
        setAgency(agencies?.find(a=>a.id===agencyId) ?? null)
        const map = {}
        ;(stockRows ?? []).forEach(row => { map[row.product_id] = row.quantity })
        setStockMap(map)
        const saved = loadOrder(agencyId)
        if (Object.keys(saved).length > 0) setOrder(saved)
      })
      .catch(console.error).finally(() => setLoading(false))
  }, [agencyId])

  const handleChange = (productId, val) =>
    setOrder(prev => { const updated = {...prev, [productId]:val}; saveOrder(agencyId,updated); return updated })

  const handleClearAll = () => { setOrder({}); clearOrder(agencyId) }

  const orderedItems = products.filter(p=>(order[p.id]?.qty??0)>0).map(p=>({name:p.name, qty:order[p.id].qty, unit:order[p.id].unit}))
  const totalItems = orderedItems.length
  const totalQty   = orderedItems.reduce((s,i)=>s+i.qty, 0)

  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''), 3000) }

  const handleSendWhatsApp = () => {
    if (orderedItems.length === 0) { showToast('Add at least one product to order.'); return }
    const waNumber = agency?.whatsapp_number
    if (!waNumber) { showToast('No WhatsApp number set.'); return }
    const date       = new Date().toLocaleDateString('en-IN', {day:'numeric',month:'long',year:'numeric'})
    const agencyName = agency?.name ?? agencyNameFromState ?? 'Agency'
    const lines      = orderedItems.map(i=>`• ${i.name} — ${i.qty} ${i.unit}`).join('\n')
    const message    = `🛒 *Order from Sampath Super Market*\n📅 ${date}\n🏪 ${agencyName}\n\n${lines}\n\nThank you!`
    window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`, '_blank')
    clearOrder(agencyId); setOrder({}); setShowPreview(false)
    showToast('Order sent on WhatsApp!')
  }

  const displayName    = agency?.name ?? agencyNameFromState ?? 'Agency'
  const submittedToday = Object.keys(stockMap).length > 0

  const filtered = products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))

  // Build WA message preview
  const date    = new Date().toLocaleDateString('en-IN', {day:'numeric',month:'long',year:'numeric'})
  const msgLines = orderedItems.map(i=>`• ${i.name} — ${i.qty} ${i.unit}`).join('\n')
  const previewMsg = `🛒 *Order from Sampath Super Market*\n📅 ${date}\n🏪 ${displayName}\n\n${msgLines}\n\nThank you!`

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-3.5 flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors shrink-0">
            <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Reorder</p>
            <h1 className="text-base font-semibold text-slate-900 truncate">{displayName}</h1>
          </div>
          <div className="flex items-center gap-2">
            {totalItems > 0 && (
              <>
                <span className="text-xs font-medium text-brand-600 bg-brand-50 border border-brand-100 px-2.5 py-1 rounded-lg">{totalItems} items</span>
                <button onClick={handleClearAll} className="text-xs font-medium text-red-500 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">Clear</button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 pb-48">
        {/* Status banner */}
        {!loading && (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl mb-4 border ${submittedToday ? 'bg-brand-50 border-brand-100' : 'bg-amber-50 border-amber-100'}`}>
            <svg className={`w-4 h-4 shrink-0 ${submittedToday ? 'text-brand-600' : 'text-amber-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {submittedToday
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                : <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>}
            </svg>
            <p className={`text-xs font-medium ${submittedToday ? 'text-brand-700' : 'text-amber-700'}`}>
              {submittedToday ? `${products.length} products · stock recorded today` : "Staff hasn't submitted stock yet"}
            </p>
          </div>
        )}

        {/* Search */}
        {!loading && products.length > 8 && (
          <div className="relative mb-4">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-600"
              placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        )}

        {/* Column headers */}
        {!loading && products.length > 0 && (
          <div className="flex items-center px-4 py-2 mb-1">
            <span className="text-[10px] font-medium text-slate-400 w-[28px] text-center">Stock</span>
            <span className="text-[10px] font-medium text-slate-400 flex-1 ml-3">Product</span>
            <span className="text-[10px] font-medium text-slate-400">Order qty</span>
          </div>
        )}

        {/* Products */}
        {loading ? <div className="flex justify-center py-20"><Spinner /></div>
        : products.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-3">
            <div className="w-14 h-14 rounded-3xl bg-slate-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
            </div>
            <p className="text-slate-400 text-sm">No products for this agency.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {filtered.map(p => (
              <ProductRow key={p.id} product={p} stockQty={stockMap[p.id]} order={order[p.id]} onChange={handleChange} />
            ))}
            {filtered.length === 0 && search && (
              <p className="text-center text-sm text-slate-400 py-8">No products match "{search}"</p>
            )}
          </div>
        )}
      </div>

      {/* WhatsApp bar */}
      <div className="fixed bottom-16 left-0 right-0 z-30 px-4 pb-3 pt-2" style={{ background: 'linear-gradient(to top, #f8fafc 70%, transparent)' }}>
        <div className="max-w-lg mx-auto">
          {totalItems > 0 && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-brand-600 bg-brand-50 border border-brand-100 px-2.5 py-1 rounded-lg">{totalItems} products</span>
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">{totalQty} total qty</span>
              <button onClick={() => setShowPreview(true)} className="ml-auto text-xs font-medium text-slate-500 hover:text-slate-700 underline">Preview message</button>
            </div>
          )}
          <button onClick={totalItems > 0 ? () => setShowPreview(true) : undefined}
            className={`w-full py-4 rounded-2xl font-medium text-sm flex items-center justify-center gap-3 transition-all active:scale-[0.98] ${totalItems > 0 ? 'bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-lg shadow-green-500/20' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current shrink-0">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            {totalItems > 0 ? `Send order on WhatsApp (${totalItems} items)` : 'Select products to order'}
          </button>
        </div>
      </div>

      {/* Message preview modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setShowPreview(false)} />
          <div className="relative bg-white rounded-t-3xl w-full max-w-lg p-6 z-10 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900">Order preview</h2>
              <button onClick={() => setShowPreview(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-2">Message that will be sent to {displayName}</p>
            <div className="bg-[#F0FFF4] border border-green-200 rounded-2xl p-4 font-mono text-xs text-slate-800 leading-relaxed whitespace-pre-wrap mb-4 max-h-64 overflow-y-auto">
              {previewMsg}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowPreview(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                Edit order
              </button>
              <button onClick={handleSendWhatsApp}
                className="flex-1 py-3 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-sm font-medium transition-colors flex items-center justify-center gap-2">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Open WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-48 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 whitespace-nowrap">
          <span className="text-brand-400">✓</span> {toast}
        </div>
      )}

      <AdminBottomNav />
    </div>
  )
}
