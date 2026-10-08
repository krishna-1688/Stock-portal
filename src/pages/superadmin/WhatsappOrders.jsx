import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getWhatsappOrders, logWhatsappOrder } from '../../services/orderService'
import { getActiveAgencies } from '../../services/agencyService'
import Spinner from '../../components/ui/spinner'

const PAGE_SIZE = 50

const fmtQty = (n) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })

function OrderCard({ order, open, onToggle, onToast }) {
  const time = new Date(order.sent_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

  const copy = async () => {
    try { await navigator.clipboard.writeText(order.message); onToast('Message copied.') }
    catch { onToast("Couldn't copy on this device.") }
  }

  const resend = () => {
    if (!order.whatsapp_number) { onToast('This agency has no WhatsApp number.'); return }
    const logged = logWhatsappOrder(order.agency_id, order.items, order.message)
    window.open(`https://wa.me/${order.whatsapp_number.replace(/\D/g, '')}?text=${encodeURIComponent(order.message)}`, '_blank', 'noopener')
    logged.then(() => onToast('Order sent again.'), () => onToast("Sent, but couldn't save to history."))
  }

  return (
    <div className={`bg-white rounded-2xl border shadow-sm transition-all ${open ? 'border-brand-200' : 'border-slate-100'}`}>
      <button onClick={onToggle} className="w-full px-4 py-3.5 flex items-center gap-3 text-left">
        <div className="w-9 h-9 rounded-xl bg-[#25D366]/10 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-[#128C7E]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2a8.2 8.2 0 01-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 01-3.3-2.9c-.2-.4.2-.4.7-1.3a.4.4 0 000-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 00-.7.3 3 3 0 00-.9 2.2 5.1 5.1 0 001.1 2.7 11.7 11.7 0 004.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 001.8-1.2 2.2 2.2 0 00.1-1.3c0-.1-.2-.2-.5-.3z"/></svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">{order.agency_name}</p>
          <p className="text-xs text-slate-400 mt-0.5 truncate">
            {time} · {order.sent_by_name ?? 'Unknown'} · {order.item_count} item{order.item_count !== 1 ? 's' : ''}
          </p>
        </div>
        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-lg shrink-0">{fmtQty(order.total_qty)} qty</span>
        <svg className={`w-4 h-4 text-slate-300 shrink-0 transition-transform ${open ? 'rotate-90 text-brand-600' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
      </button>

      {open && (
        <div className="border-t border-slate-50 px-4 pb-4">
          <div className="divide-y divide-slate-50">
            {order.items.map((it, i) => (
              <div key={i} className="flex items-center justify-between gap-3 py-2.5">
                <p className="text-sm text-slate-700 min-w-0 truncate">{it.name}</p>
                <p className="text-sm font-medium text-slate-900 shrink-0">{fmtQty(it.qty)} <span className="text-xs font-normal text-slate-400">{it.unit}</span></p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-slate-400 flex-1 min-w-0 truncate">
              {order.whatsapp_number ? `Sent to +${order.whatsapp_number.replace(/\D/g, '')}` : 'No number on file'}
            </span>
            <button onClick={copy} className="text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-colors">Copy</button>
            <button onClick={resend} className="text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 px-3 py-2 rounded-xl transition-colors">Send again</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function WhatsappOrders() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [agencies, setAgencies] = useState([])
  const [agencyId, setAgencyId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [openId, setOpenId] = useState(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const load = useCallback(async (selectedAgency) => {
    setLoading(true); setError('')
    try {
      const rows = (await getWhatsappOrders({ agencyId: selectedAgency, limit: PAGE_SIZE })) ?? []
      setOrders(rows); setHasMore(rows.length === PAGE_SIZE)
    } catch (e) {
      setError(/schema cache|Could not find/.test(e.message) ? 'Order history is not set up yet (run database migration 003).' : e.message)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { getActiveAgencies().then(a => setAgencies(a ?? [])).catch(() => {}) }, [])
  useEffect(() => { load(agencyId) }, [agencyId, load])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const rows = (await getWhatsappOrders({ agencyId, before: orders.at(-1)?.sent_at, limit: PAGE_SIZE })) ?? []
      setOrders(o => [...o, ...rows]); setHasMore(rows.length === PAGE_SIZE)
    } catch (e) { showToast(e.message) } finally { setLoadingMore(false) }
  }

  const grouped = orders.reduce((acc, o) => {
    const d = new Date(o.sent_at).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    ;(acc[d] ??= []).push(o)
    return acc
  }, {})

  const chip = (active) => `shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-all ${active ? 'bg-brand-600 text-white' : 'bg-white text-slate-500 border border-slate-100 hover:border-slate-200'}`

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/super/dashboard')}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
            <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <div>
            <h1 className="text-base font-semibold text-slate-900">WhatsApp Orders</h1>
            <p className="text-xs text-slate-400">Orders sent to agencies on WhatsApp</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-16 pt-4">
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4" style={{ scrollbarWidth: 'none' }}>
          <button onClick={() => setAgencyId(null)} className={chip(agencyId === null)}>All</button>
          {agencies.map(a => (
            <button key={a.id} onClick={() => setAgencyId(a.id)} className={chip(agencyId === a.id)}>{a.name}</button>
          ))}
        </div>

        {loading ? <div className="flex justify-center py-16"><Spinner /></div>
        : error ? (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 text-sm text-amber-700">{error}</div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-3">
            <div className="w-14 h-14 rounded-3xl bg-slate-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
            </div>
            <p className="text-slate-400 text-sm text-center">No WhatsApp orders yet.<br />Orders sent from an agency's page appear here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {Object.entries(grouped).map(([date, list]) => (
              <div key={date}>
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">{date}</p>
                  <div className="flex-1 h-px bg-slate-100" />
                  <span className="text-xs text-slate-400">{list.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {list.map(o => (
                    <OrderCard key={o.id} order={o} open={openId === o.id}
                      onToggle={() => setOpenId(id => id === o.id ? null : o.id)} onToast={showToast} />
                  ))}
                </div>
              </div>
            ))}
            {hasMore && (
              <button onClick={loadMore} disabled={loadingMore}
                className="w-full py-3 rounded-xl bg-white border border-slate-100 text-sm font-medium text-slate-600 hover:border-slate-200 disabled:opacity-60">
                {loadingMore ? 'Loading…' : 'Load older orders'}
              </button>
            )}
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg max-w-[90vw] text-center">
          {toast}
        </div>
      )}
    </div>
  )
}
