import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { getProductsByAgency } from '../../services/productService'
import { getAllAgenciesAdmin } from '../../services/agencyService'
import { getAgencyProductsWithQty } from '../../services/stockService'
import Spinner from '../../components/ui/Spinner'

// ── Units ─────────────────────────────────────────────────────────────────────
const UNITS = ['pcs', 'carton', 'dozen', 'half dozen', 'kg', 'g', 'litre', 'ml', 'pack', 'box', 'bag']

// ── Unit Picker Popup ─────────────────────────────────────────────────────────
function UnitPicker({ current, onChange, onClose, anchorRef }) {
  const popupRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (
        popupRef.current && !popupRef.current.contains(e.target) &&
        anchorRef.current && !anchorRef.current.contains(e.target)
      ) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose, anchorRef])

  return (
    <div
      ref={popupRef}
      className="absolute right-0 bottom-full mb-1 z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
      style={{ minWidth: 140 }}
    >
      {UNITS.map(u => (
        <button
          key={u}
          onClick={() => { onChange(u); onClose() }}
          className={`w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors ${
            u === current ? 'bg-brand-600 text-white' : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          {u}
        </button>
      ))}
    </div>
  )
}

// ── Product Row ───────────────────────────────────────────────────────────────
function ProductRow({ product, stockQty, order, onChange }) {
  const [showPicker, setShowPicker] = useState(false)
  const unitBtnRef = useRef(null)

  const qty  = order?.qty  ?? 0
  const unit = order?.unit ?? 'pcs'

  const setQty = (val) => {
    const n = Math.max(0, Math.min(9999, Number(val) || 0))
    onChange(product.id, { qty: n, unit })
  }
  const setUnit = (u) => onChange(product.id, { qty, unit: u })

  const isOrdered    = qty > 0
  const hasStock     = stockQty !== null && stockQty !== undefined
  const stockDisplay = hasStock ? stockQty : '—'

  return (
    <div className={`bg-white rounded-[20px] border transition-all duration-200 shadow-sm ${
      isOrdered ? 'border-[#25D366]/40 shadow-green-50' : 'border-gray-100'
    }`}>
      {/* Product name */}
      <div className="px-4 pt-3.5 pb-2 flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 ${
          isOrdered ? 'bg-green-50' : 'bg-gray-50'
        }`}>📦</div>
        <p className="text-sm font-bold flex-1 min-w-0 truncate text-gray-900">{product.name}</p>
        {isOrdered && (
          <span className="shrink-0 text-xs font-bold text-[#25D366] bg-green-50 px-2 py-0.5 rounded-full">
            ordering
          </span>
        )}
      </div>

      {/* Stock + Order side by side */}
      <div className="px-4 pb-3.5 flex items-center gap-3">
        {/* Stock badge */}
        <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block leading-none">In stock</span>
          <span className={`text-lg font-black leading-tight mt-0.5 block ${
            hasStock && stockQty > 0 ? 'text-gray-800' : 'text-gray-300'
          }`}>{stockDisplay}</span>
        </div>

        <div className="text-gray-300 text-lg">→</div>

        {/* Order controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setQty(qty - 1)}
            disabled={qty === 0}
            className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-lg transition-all active:scale-90 ${
              qty === 0 ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-red-50 text-red-500 hover:bg-red-100'
            }`}
          >−</button>

          <input
            type="number"
            min={0}
            max={9999}
            value={qty === 0 ? '' : qty}
            placeholder="0"
            onChange={e => setQty(e.target.value)}
            className={`w-12 h-8 rounded-xl border text-center text-sm font-black focus:outline-none focus:ring-2 focus:ring-[#25D366] transition-all ${
              isOrdered
                ? 'border-[#25D366]/50 bg-green-50 text-green-700'
                : 'border-gray-200 bg-gray-50 text-gray-700'
            }`}
          />

          <button
            onClick={() => setQty(qty + 1)}
            className="w-8 h-8 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-600 flex items-center justify-center font-bold text-lg transition-all active:scale-90"
          >+</button>

          <div className="relative">
            <button
              ref={unitBtnRef}
              onClick={() => setShowPicker(v => !v)}
              className={`h-8 px-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-1 ${
                isOrdered
                  ? 'bg-[#25D366] text-white border-[#25D366] shadow-sm shadow-green-400/30'
                  : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
              }`}
            >
              {unit}
              <svg className="w-3 h-3 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showPicker && (
              <UnitPicker
                current={unit}
                onChange={setUnit}
                onClose={() => setShowPicker(false)}
                anchorRef={unitBtnRef}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
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

  const agencyNameFromState = location.state?.agencyName

  useEffect(() => {
    Promise.all([
      getProductsByAgency(agencyId),
      getAllAgenciesAdmin(),
      getAgencyProductsWithQty(agencyId).catch(() => []),
    ])
      .then(([prods, agencies, stockRows]) => {
        setProducts(prods ?? [])
        const found = agencies?.find(a => a.id === agencyId)
        setAgency(found ?? null)
        const map = {}
        ;(stockRows ?? []).forEach(row => { map[row.product_id] = row.quantity })
        setStockMap(map)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [agencyId])

  const handleChange = (productId, val) =>
    setOrder(prev => ({ ...prev, [productId]: val }))

  const orderedItems = products
    .filter(p => (order[p.id]?.qty ?? 0) > 0)
    .map(p => ({ name: p.name, qty: order[p.id].qty, unit: order[p.id].unit }))

  const totalItems = orderedItems.length
  const totalQty   = orderedItems.reduce((s, i) => s + i.qty, 0)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const handleSendWhatsApp = () => {
    if (orderedItems.length === 0) { showToast('Add at least one product to order.'); return }
    const waNumber = agency?.whatsapp_number
    if (!waNumber) { showToast('No WhatsApp number set. Ask super admin to add it.'); return }

    const date       = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    const agencyName = agency?.name ?? agencyNameFromState ?? 'Agency'
    const lines      = orderedItems.map(i => `• ${i.name} — ${i.qty} ${i.unit}`).join('\n')

    const message =
      `🛒 *Order Request*\n📅 ${date}\n🏪 ${agencyName}\n\n${lines}\n\nPlease confirm availability. Thank you!`

    window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`, '_blank')
  }

  const displayName    = agency?.name ?? agencyNameFromState ?? 'Agency'
  const submittedToday = Object.keys(stockMap).length > 0

  return (
    <div className="min-h-screen bg-[#F5F6FA]">

      {/* Top Bar */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
              <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <p className="text-sm font-black text-gray-900 leading-none">{displayName}</p>
              <p className="text-xs text-gray-400 leading-none mt-0.5">
                {submittedToday ? 'Stock submitted today ✅' : 'No submission today'}
              </p>
            </div>
          </div>
          {totalItems > 0 && (
            <button onClick={() => setOrder({})} className="text-xs font-bold text-red-500 hover:text-red-600 px-3 py-1.5 rounded-xl hover:bg-red-50 transition-colors">
              Clear all
            </button>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 pb-48">

        {/* Banner */}
        {!loading && (
          <div className="relative overflow-hidden rounded-[24px] p-5 mb-5 shadow-lg"
            style={{ background: submittedToday ? 'linear-gradient(135deg,#16a34a,#15803d)' : 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
            <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-white/5" />
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-1">Today's Stock</p>
                <p className="text-white font-black text-xl">{displayName}</p>
                <p className="text-white/70 text-sm mt-1">
                  {submittedToday ? `${products.length} products · stock recorded` : "Staff hasn't submitted yet"}
                </p>
              </div>
              <div className="text-3xl">{submittedToday ? '✅' : '⏳'}</div>
            </div>
            <div className="mt-3">
              {agency?.whatsapp_number
                ? <span className="flex items-center gap-1.5 text-xs font-semibold text-white/70"><span className="w-1.5 h-1.5 rounded-full bg-green-300" />WhatsApp ready</span>
                : <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-200"><span className="w-1.5 h-1.5 rounded-full bg-amber-300" />No WhatsApp — ask super admin</span>
              }
            </div>
          </div>
        )}

        {/* Products */}
        {loading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-3">
            <div className="w-14 h-14 rounded-3xl bg-gray-100 flex items-center justify-center text-3xl">📦</div>
            <p className="text-gray-500 font-medium text-sm">No products for this agency.</p>
          </div>
        ) : (
          <>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
              {products.length} Products — Stock · Order
            </p>
            <div className="flex flex-col gap-2.5">
              {products.map(p => (
                <ProductRow
                  key={p.id}
                  product={p}
                  stockQty={stockMap[p.id]}
                  order={order[p.id]}
                  onChange={handleChange}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Sticky bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-5">
        <div className="max-w-lg mx-auto">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-black/10 border border-gray-100 p-4">
            {totalItems > 0 ? (
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <div className="px-3 py-1.5 bg-brand-50 rounded-xl">
                  <span className="text-brand-700 text-xs font-black">{totalItems} items</span>
                </div>
                <div className="px-3 py-1.5 bg-green-50 rounded-xl">
                  <span className="text-green-700 text-xs font-black">{totalQty} total qty</span>
                </div>
                <span className="text-xs text-gray-400 font-medium ml-auto">ready to send</span>
              </div>
            ) : (
              <p className="text-xs text-gray-400 font-medium text-center mb-3">Set order quantities above → then send</p>
            )}

            <button
              onClick={handleSendWhatsApp}
              disabled={totalItems === 0}
              className={`w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-3 transition-all duration-200 active:scale-[0.98] ${
                totalItems > 0
                  ? 'bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-lg shadow-[#25D366]/30'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              {totalItems > 0 ? 'Send Order on WhatsApp' : 'Select products to order'}
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 whitespace-nowrap">
          <span className="text-amber-400">⚠</span> {toast}
        </div>
      )}
    </div>
  )
}