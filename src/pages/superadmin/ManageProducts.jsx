import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getAllProductsAdmin,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../../services/productService'
import { getActiveAgencies } from '../../services/agencyService'
import Modal from '../../components/ui/modal'
import Button from '../../components/ui/button'
import Spinner from '../../components/ui/spinner'
import Alert from '../../components/ui/alert'

/* ---------------------------------------------------------------- */
/* Shared bits                                                       */
/* ---------------------------------------------------------------- */

function Field({ label, children, hint }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent focus:bg-white transition-all'

/* ---------------------------------------------------------------- */
/* BULK ADD                                                          */
/* ---------------------------------------------------------------- */

function BulkAddSheet({ open, onClose, onDone, agencies, existingProducts }) {
  const [agencyId, setAgencyId] = useState('')
  const [input, setInput] = useState('')
  const [queue, setQueue] = useState([]) // [{ name, dup }]
  const [phase, setPhase] = useState('build') // build | running | done
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [results, setResults] = useState({ ok: 0, failed: [] })
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setInput('')
      setQueue([])
      setPhase('build')
      setProgress({ done: 0, total: 0 })
      setResults({ ok: 0, failed: [] })
      setAgencyId(prev => prev || (agencies[0]?.id ?? ''))
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [open, agencies])

  // names already in DB for the selected agency (case-insensitive)
  const existingNames = useMemo(() => {
    const set = new Set()
    existingProducts
      .filter(p => String(p.agency_id) === String(agencyId))
      .forEach(p => set.add(p.name.trim().toLowerCase()))
    return set
  }, [existingProducts, agencyId])

  const markDups = (items) =>
    items.map(q => ({
      ...q,
      dup:
        existingNames.has(q.name.toLowerCase()) ||
        items.filter(x => x.name.toLowerCase() === q.name.toLowerCase()).length > 1,
    }))

  // re-check duplicates when agency changes
  useEffect(() => {
    setQueue(q => markDups(q))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyId])

  const addNames = (raw) => {
    const names = raw
      .split('\n')
      .map(s => s.trim().replace(/^[-•*\d.)\s]+/, '').trim()) // strip list bullets/numbers
      .filter(Boolean)
    if (!names.length) return
    setQueue(q => {
      const merged = [...q]
      names.forEach(n => {
        if (!merged.some(x => x.name.toLowerCase() === n.toLowerCase())) {
          merged.push({ name: n, dup: false })
        }
      })
      return markDups(merged)
    })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (input.trim()) {
        addNames(input)
        setInput('')
      }
    }
  }

  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text')
    if (text.includes('\n')) {
      e.preventDefault()
      addNames(text)
      setInput('')
    }
  }

  const removeItem = (name) =>
    setQueue(q => markDups(q.filter(x => x.name !== name)))

  const validQueue = queue.filter(q => !q.dup)
  const dupCount = queue.length - validQueue.length

  const runBulkCreate = async () => {
    if (!agencyId || validQueue.length === 0) return
    setPhase('running')
    setProgress({ done: 0, total: validQueue.length })
    const res = { ok: 0, failed: [] }
    for (const item of validQueue) {
      try {
        await createProduct(agencyId, item.name)
        res.ok++
      } catch (e) {
        res.failed.push({ name: item.name, err: e.message })
      }
      setProgress(p => ({ ...p, done: p.done + 1 }))
    }
    setResults(res)
    setPhase('done')
  }

  const agencyName = agencies.find(a => String(a.id) === String(agencyId))?.name ?? ''

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={phase === 'running' ? undefined : onClose} />
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl">

        {/* header */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Bulk Add Products</h2>
            <p className="text-xs text-slate-400 mt-0.5">Select agency once · add many products fast</p>
          </div>
          {phase !== 'running' && (
            <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* BUILD PHASE */}
        {phase === 'build' && (
          <>
            <div className="px-5 py-4 flex flex-col gap-4 overflow-y-auto">
              <Field label="Agency (applies to all products below)">
                <select className={inputCls} value={agencyId} onChange={e => setAgencyId(e.target.value)}>
                  {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </Field>

              <Field
                label="Product Names"
                hint="Type a name and press Enter — or paste a list (one product per line)."
              >
                <input
                  ref={inputRef}
                  className={inputCls}
                  placeholder="e.g. KitKat 4F  →  press Enter"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                />
              </Field>

              {/* queue */}
              {queue.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Queue · {queue.length}
                    </span>
                    <button onClick={() => setQueue([])} className="text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors">
                      Clear all
                    </button>
                  </div>

                  {dupCount > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                      <span className="text-amber-500">⚠</span>
                      <p className="text-xs text-amber-700 font-medium">
                        {dupCount} duplicate{dupCount > 1 ? 's' : ''} (already exist in {agencyName || 'this agency'}) — will be skipped.
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto py-1">
                    {queue.map(q => (
                      <span
                        key={q.name}
                        className={`inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full text-xs font-semibold border ${
                          q.dup
                            ? 'bg-amber-50 text-amber-700 border-amber-200 line-through'
                            : 'bg-brand-50 text-brand-700 border-brand-200'
                        }`}
                      >
                        {q.name}
                        <button
                          onClick={() => removeItem(q.name)}
                          className="w-4 h-4 rounded-full bg-white/70 hover:bg-white flex items-center justify-center text-[10px]"
                        >✕</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
              <Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
              <Button
                variant="primary"
                fullWidth
                disabled={!agencyId || validQueue.length === 0}
                onClick={runBulkCreate}
              >
                Create {validQueue.length > 0 ? `${validQueue.length} Product${validQueue.length > 1 ? 's' : ''}` : 'Products'}
              </Button>
            </div>
          </>
        )}

        {/* RUNNING PHASE */}
        {phase === 'running' && (
          <div className="px-5 py-10 flex flex-col items-center gap-5">
            <Spinner />
            <div className="w-full max-w-xs">
              <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1.5">
                <span>Creating products…</span>
                <span>{progress.done} / {progress.total}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-600 rounded-full transition-all duration-200"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
            <p className="text-xs text-slate-400">Please don't close this window.</p>
          </div>
        )}

        {/* DONE PHASE */}
        {phase === 'done' && (
          <>
            <div className="px-5 py-8 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-3xl bg-brand-50 flex items-center justify-center text-3xl">
                {results.failed.length === 0 ? '✅' : '⚠️'}
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-slate-900">{results.ok} product{results.ok !== 1 ? 's' : ''} created</p>
                {results.failed.length > 0 && (
                  <p className="text-sm text-red-600 font-medium mt-1">{results.failed.length} failed</p>
                )}
              </div>
              {results.failed.length > 0 && (
                <div className="w-full max-h-36 overflow-y-auto flex flex-col gap-1.5">
                  {results.failed.map(f => (
                    <div key={f.name} className="text-xs bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                      <span className="font-semibold text-red-700">{f.name}</span>
                      <span className="text-red-500"> — {f.err}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
              <Button variant="secondary" fullWidth onClick={() => { setQueue([]); setInput(''); setPhase('build'); setTimeout(() => inputRef.current?.focus(), 100) }}>
                Add More
              </Button>
              <Button variant="primary" fullWidth onClick={() => { onDone(results.ok); onClose() }}>Done</Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- */
/* SINGLE ADD / EDIT / DELETE (kept, restyled)                       */
/* ---------------------------------------------------------------- */

function AddModal({ open, onClose, onSuccess, agencies }) {
  const [name, setName] = useState('')
  const [agencyId, setAgencyId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setName(''); setError('')
      setAgencyId(agencies[0]?.id ?? '')
    }
  }, [open, agencies])

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Product name is required.'); return }
    if (!agencyId) { setError('Select an agency.'); return }
    setLoading(true); setError('')
    try {
      await createProduct(agencyId, name.trim())
      onSuccess('Product created.')
      onClose()
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Single Product">
      <div className="flex flex-col gap-4">
        {error && <Alert type="error" message={error} />}
        <Field label="Agency">
          <select className={inputCls} value={agencyId} onChange={e => setAgencyId(e.target.value)}>
            {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="Product Name">
          <input className={inputCls} placeholder="e.g. KitKat 4F" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
        </Field>
        <div className="flex gap-3 mt-2">
          <Button variant="secondary" fullWidth onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="primary" fullWidth onClick={handleSubmit} loading={loading}>Create</Button>
        </div>
      </div>
    </Modal>
  )
}

function EditModal({ open, onClose, onSuccess, product, agencies }) {
  const [name, setName] = useState('')
  const [agencyId, setAgencyId] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (product) {
      setName(product.name)
      setAgencyId(product.agency_id)
      setIsActive(product.is_active)
      setError('')
    }
  }, [product])

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Name is required.'); return }
    if (!agencyId) { setError('Select an agency.'); return }
    setLoading(true); setError('')
    try {
      await updateProduct(product.id, name.trim(), agencyId, isActive)
      onSuccess('Product updated.')
      onClose()
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Product">
      <div className="flex flex-col gap-4">
        {error && <Alert type="error" message={error} />}
        <Field label="Agency">
          <select className={inputCls} value={agencyId} onChange={e => setAgencyId(e.target.value)}>
            {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="Product Name">
          <input className={inputCls} value={name} onChange={e => setName(e.target.value)} />
        </Field>
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-xl">
          <div>
            <span className="text-sm font-medium text-slate-700 block">Active</span>
            <span className="text-xs text-slate-400">Inactive products are hidden from staff</span>
          </div>
          <button
            onClick={() => setIsActive(v => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${isActive ? 'bg-brand-600' : 'bg-slate-300'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${isActive ? 'translate-x-5' : ''}`} />
          </button>
        </div>
        <div className="flex gap-3 mt-2">
          <Button variant="secondary" fullWidth onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="primary" fullWidth onClick={handleSubmit} loading={loading}>Save Changes</Button>
        </div>
      </div>
    </Modal>
  )
}

function DeleteModal({ open, onClose, onSuccess, product }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleDelete = async () => {
    setLoading(true); setError('')
    try {
      await deleteProduct(product.id)
      onSuccess('Product deleted.')
      onClose()
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Delete Product">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 p-4 bg-red-50 rounded-2xl">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-xl shrink-0">⚠️</div>
          <p className="text-sm text-red-700">
            Delete <span className="font-semibold">{product?.name}</span>? This cannot be undone.
            If this product has past submissions, consider marking it <span className="font-semibold">Inactive</span> instead.
          </p>
        </div>
        {error && <Alert type="error" message={error} />}
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="danger" fullWidth onClick={handleDelete} loading={loading}>Delete</Button>
        </div>
      </div>
    </Modal>
  )
}

function ActionMenu({ product, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-20 w-40 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
            <button
              onClick={() => { setOpen(false); onEdit(product) }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >✏️ Edit</button>
            <button
              onClick={() => { setOpen(false); onDelete(product) }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50"
            >🗑️ Delete</button>
          </div>
        </>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- */
/* MAIN PAGE                                                         */
/* ---------------------------------------------------------------- */

export default function ManageProducts() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [agencies, setAgencies] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterAgency, setFilterAgency] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [toast, setToast] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [collapsed, setCollapsed] = useState({}) // { [agencyName]: true }

  const load = async () => {
    try {
      const [p, a] = await Promise.all([getAllProductsAdmin(), getActiveAgencies()])
      setProducts(p ?? [])
      setAgencies(a ?? [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000) }
  const handleSuccess = msg => { showToast(msg); load() }
  const handleBulkDone = count => {
    if (count > 0) { showToast(`${count} products added.`); load() }
  }

  const filtered = products.filter(p => {
    const ms = !search || p.name?.toLowerCase().includes(search.toLowerCase())
    const ma = filterAgency === 'all' || String(p.agency_id) === String(filterAgency)
    const mst = filterStatus === 'all' || (filterStatus === 'active' && p.is_active) || (filterStatus === 'inactive' && !p.is_active)
    return ms && ma && mst
  })

  const activeCount = products.filter(p => p.is_active).length
  const isFiltering = search || filterAgency !== 'all' || filterStatus !== 'all'

  const grouped = filtered.reduce((acc, p) => {
    const key = p.agency_name ?? 'Unknown'
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

  const toggleGroup = (name) =>
    setCollapsed(c => ({ ...c, [name]: !c[name] }))

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors shrink-0"
          >
            <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-slate-900 leading-tight">Manage Products</h1>
            <p className="text-xs text-slate-400">{products.length} total · {activeCount} active</p>
          </div>

          {/* Add split button */}
          <div className="relative">
            <button
              onClick={() => setAddMenuOpen(v => !v)}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm shadow-brand-600/30 active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add
              <svg className="w-3 h-3 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {addMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setAddMenuOpen(false)} />
                <div className="absolute right-0 top-12 z-20 w-52 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                  <button
                    onClick={() => { setAddMenuOpen(false); setBulkOpen(true) }}
                    className="w-full flex flex-col items-start px-4 py-3 hover:bg-slate-50 text-left"
                  >
                    <span className="text-sm font-semibold text-slate-800">⚡ Bulk Add</span>
                    <span className="text-xs text-slate-400">Many products, one agency</span>
                  </button>
                  <div className="h-px bg-slate-100" />
                  <button
                    onClick={() => { setAddMenuOpen(false); setAddOpen(true) }}
                    className="w-full flex flex-col items-start px-4 py-3 hover:bg-slate-50 text-left"
                  >
                    <span className="text-sm font-semibold text-slate-800">＋ Single Product</span>
                    <span className="text-xs text-slate-400">Add one product</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 flex flex-col gap-4">
        {/* stats — flat corporate cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Products', value: products.length, accent: 'text-slate-900', bar: 'bg-slate-900' },
            { label: 'Active', value: activeCount, accent: 'text-brand-700', bar: 'bg-brand-600' },
            { label: 'Agencies', value: agencies.length, accent: 'text-sky-700', bar: 'bg-sky-600' },
          ].map(({ label, value, accent, bar }) => (
            <div key={label} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm relative overflow-hidden">
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${bar}`} />
              <p className={`text-2xl font-semibold ${accent}`}>{value}</p>
              <p className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* search + filters */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              placeholder="Search products…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="rounded-xl border border-slate-200 bg-white text-sm text-slate-700 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 max-w-[130px]"
            value={filterAgency}
            onChange={e => setFilterAgency(e.target.value)}
          >
            <option value="all">All Agencies</option>
            {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select
            className="rounded-xl border border-slate-200 bg-white text-sm text-slate-700 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* list */}
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center text-3xl">📦</div>
            <p className="text-slate-500 font-medium text-sm">
              {isFiltering ? 'No products match your filter.' : 'No products yet.'}
            </p>
            {!isFiltering && (
              <button onClick={() => setBulkOpen(true)} className="text-brand-600 text-sm font-semibold">Bulk add your first products →</button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {Object.entries(grouped).map(([agencyName, items]) => {
              const isCollapsed = collapsed[agencyName] && !isFiltering
              return (
                <div key={agencyName} className="bg-white rounded-2xl border border-slate-100 shadow-sm">
                  {/* group header */}
                  <button
                    onClick={() => toggleGroup(agencyName)}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition-colors rounded-t-2xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center text-sm font-semibold text-brand-700 shrink-0">
                        {agencyName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-slate-900">{agencyName}</p>
                        <p className="text-xs text-slate-400">{items.length} product{items.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <svg
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* group items */}
                  {!isCollapsed && (
                    <div className="border-t border-slate-50">
                      {items.map((p, idx) => (
                        <div
                          key={p.id}
                          className={`px-4 py-3 flex items-center gap-3 hover:bg-slate-50/70 transition-colors ${idx !== items.length - 1 ? 'border-b border-slate-50' : ''}`}
                        >
                          <span className={`w-2 h-2 rounded-full shrink-0 ${p.is_active ? 'bg-brand-500' : 'bg-slate-300'}`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold truncate ${p.is_active ? 'text-slate-900' : 'text-slate-400'}`}>{p.name}</p>
                          </div>
                          {!p.is_active && (
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Inactive</span>
                          )}
                          <ActionMenu product={p} onEdit={setEditTarget} onDelete={setDeleteTarget} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <BulkAddSheet
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onDone={handleBulkDone}
        agencies={agencies}
        existingProducts={products}
      />
      <AddModal open={addOpen} onClose={() => setAddOpen(false)} onSuccess={handleSuccess} agencies={agencies} />
      <EditModal open={!!editTarget} onClose={() => setEditTarget(null)} onSuccess={handleSuccess} product={editTarget} agencies={agencies} />
      <DeleteModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onSuccess={handleSuccess} product={deleteTarget} />

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 whitespace-nowrap">
          <span className="text-brand-400">✓</span> {toast}
        </div>
      )}
    </div>
  )
}