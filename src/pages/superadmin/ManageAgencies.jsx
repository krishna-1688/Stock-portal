import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getAllAgenciesAdmin,
  createAgency,
  updateAgency,
  deleteAgency,
} from '../../services/agencyService'
import Modal from '../../components/ui/modal'
import Button from '../../components/ui/button'
import Spinner from '../../components/ui/spinner'
import Alert from '../../components/ui/alert'

function Field({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

const inputCls =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent focus:bg-white transition-all'

// Strips any non-digit chars, ensures it starts with country code
function normalizeWA(raw) {
  const digits = raw.replace(/\D/g, '')
  return digits || null
}

function AddModal({ open, onClose, onSuccess }) {
  const [name, setName]       = useState('')
  const [waNum, setWaNum]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Agency name is required.'); return }
    setLoading(true); setError('')
    try {
      await createAgency(name.trim(), normalizeWA(waNum))
      onSuccess('Agency created.')
      onClose()
      setName(''); setWaNum('')
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add New Agency">
      <div className="flex flex-col gap-4">
        {error && <Alert type="error" message={error} />}

        <Field label="Agency Name">
          <input
            className={inputCls}
            placeholder="e.g. Nestle"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </Field>

        <Field
          label="WhatsApp Number"
          hint="Include country code, no + or spaces. e.g. 919876543210"
        >
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base">📱</span>
            <input
              className={inputCls + ' pl-9'}
              placeholder="919876543210"
              value={waNum}
              onChange={e => setWaNum(e.target.value)}
              type="tel"
              inputMode="numeric"
            />
          </div>
        </Field>

        <div className="flex gap-3 mt-2">
          <Button variant="secondary" fullWidth onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="primary" fullWidth onClick={handleSubmit} loading={loading}>Create</Button>
        </div>
      </div>
    </Modal>
  )
}

function EditModal({ open, onClose, onSuccess, agency }) {
  const [name, setName]         = useState('')
  const [isActive, setIsActive] = useState(true)
  const [waNum, setWaNum]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    if (agency) {
      setName(agency.name)
      setIsActive(agency.is_active)
      setWaNum(agency.whatsapp_number ?? '')
    }
  }, [agency])

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Name is required.'); return }
    setLoading(true); setError('')
    try {
      await updateAgency(agency.id, name.trim(), isActive, normalizeWA(waNum))
      onSuccess('Agency updated.')
      onClose()
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Agency">
      <div className="flex flex-col gap-4">
        {error && <Alert type="error" message={error} />}

        <Field label="Agency Name">
          <input
            className={inputCls}
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </Field>

        <Field
          label="WhatsApp Number"
          hint="Include country code, no + or spaces. e.g. 919876543210"
        >
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base">📱</span>
            <input
              className={inputCls + ' pl-9'}
              placeholder="919876543210"
              value={waNum}
              onChange={e => setWaNum(e.target.value)}
              type="tel"
              inputMode="numeric"
            />
          </div>
        </Field>

        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl">
          <span className="text-sm font-medium text-gray-700">Active</span>
          <button
            onClick={() => setIsActive(v => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${isActive ? 'bg-brand-600' : 'bg-gray-300'}`}
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

function DeleteModal({ open, onClose, onSuccess, agency }) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const handleDelete = async () => {
    setLoading(true); setError('')
    try {
      await deleteAgency(agency.id)
      onSuccess('Agency deleted.')
      onClose()
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Delete Agency">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 p-4 bg-red-50 rounded-2xl">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-xl shrink-0">⚠️</div>
          <p className="text-sm text-red-700">Delete <span className="font-bold">{agency?.name}</span>? This cannot be undone.</p>
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

function ActionMenu({ agency, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-20 w-40 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <button
              onClick={() => { setOpen(false); onEdit(agency) }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >✏️ Edit</button>
            <button
              onClick={() => { setOpen(false); onDelete(agency) }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50"
            >🗑️ Delete</button>
          </div>
        </>
      )}
    </div>
  )
}

export default function ManageAgencies() {
  const navigate = useNavigate()
  const [agencies, setAgencies]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [filter, setFilter]           = useState('all')
  const [toast, setToast]             = useState('')
  const [addOpen, setAddOpen]         = useState(false)
  const [editTarget, setEditTarget]   = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const load = async () => {
    try {
      const data = await getAllAgenciesAdmin()
      setAgencies(data ?? [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000) }
  const handleSuccess = msg => { showToast(msg); load() }

  const filtered = agencies.filter(a => {
    const mf = filter === 'all' || (filter === 'active' && a.is_active) || (filter === 'inactive' && !a.is_active)
    const ms = !search || a.name?.toLowerCase().includes(search.toLowerCase())
    return mf && ms
  })

  const activeCount = agencies.filter(a => a.is_active).length
  const waCount     = agencies.filter(a => a.whatsapp_number).length

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors shrink-0"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-black text-gray-900 leading-tight">Manage Agencies</h1>
            <p className="text-xs text-gray-400">{agencies.length} total · {activeCount} active · {waCount} on WhatsApp</p>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors shadow-sm shadow-brand-600/30 active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 flex flex-col gap-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total',    value: agencies.length,              from: '#16a34a', to: '#15803d' },
            { label: 'Active',   value: activeCount,                  from: '#0284c7', to: '#0369a1' },
            { label: 'On WA',    value: waCount,                      from: '#16a34a', to: '#128C7E' },
          ].map(({ label, value, from, to }) => (
            <div key={label} className="relative overflow-hidden rounded-2xl p-4 shadow-sm" style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}>
              <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-white/10" />
              <p className="text-2xl font-black text-white">{value}</p>
              <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Search + filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              placeholder="Search agencies…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="rounded-xl border border-gray-200 bg-white text-sm text-gray-700 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <div className="w-16 h-16 rounded-3xl bg-gray-100 flex items-center justify-center text-3xl">🏪</div>
            <p className="text-gray-500 font-medium text-sm">
              {search || filter !== 'all' ? 'No agencies match your filter.' : 'No agencies yet.'}
            </p>
            {!search && filter === 'all' && (
              <button onClick={() => setAddOpen(true)} className="text-brand-600 text-sm font-semibold">Add your first agency →</button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map(a => (
              <div key={a.id} className="bg-white rounded-2xl border border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm hover:shadow-md hover:border-gray-200 transition-all">
                <div className="w-10 h-10 rounded-2xl bg-brand-50 flex items-center justify-center text-lg shrink-0">🏪</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">{a.name}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${a.is_active ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${a.is_active ? 'bg-brand-600' : 'bg-gray-400'}`} />
                      {a.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {a.whatsapp_number ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                        📱 WA set
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-600">
                        ⚠ No WA
                      </span>
                    )}
                  </div>
                </div>
                <ActionMenu agency={a} onEdit={setEditTarget} onDelete={setDeleteTarget} />
              </div>
            ))}
          </div>
        )}
      </div>

      <AddModal    open={addOpen}      onClose={() => setAddOpen(false)}      onSuccess={handleSuccess} />
      <EditModal   open={!!editTarget} onClose={() => setEditTarget(null)}    onSuccess={handleSuccess} agency={editTarget} />
      <DeleteModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onSuccess={handleSuccess} agency={deleteTarget} />

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 whitespace-nowrap">
          <span className="text-brand-400">✓</span> {toast}
        </div>
      )}
    </div>
  )
}