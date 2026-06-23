import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  getUsers,
  createUser,
  updateUser,
  resetPassword,
  deleteUser,
} from '../../services/userService'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import Alert from '../../components/ui/Alert'

// ─── helpers ────────────────────────────────────────────────────────────────

const ROLE_META = {
  admin: {
    label: 'Admin',
    bg: 'bg-violet-100',
    text: 'text-violet-700',
    dot: 'bg-violet-500',
  },
  staff: {
    label: 'Staff',
    bg: 'bg-sky-100',
    text: 'text-sky-700',
    dot: 'bg-sky-500',
  },
}

function RoleBadge({ role }) {
  const m = ROLE_META[role] ?? { label: role, bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${m.bg} ${m.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  )
}

function Avatar({ name }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
  const hue = name.charCodeAt(0) % 6
  const palettes = [
    'from-violet-500 to-purple-600',
    'from-sky-500 to-blue-600',
    'from-emerald-500 to-green-600',
    'from-rose-500 to-pink-600',
    'from-amber-500 to-orange-600',
    'from-teal-500 to-cyan-600',
  ]
  return (
    <div
      className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${palettes[hue]} flex items-center justify-center text-white text-sm font-black shrink-0 shadow-sm`}
    >
      {initials || '?'}
    </div>
  )
}

// ─── form fields ─────────────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}

const inputCls =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent focus:bg-white transition-all'

// ─── modals ──────────────────────────────────────────────────────────────────

function AddUserModal({ open, onClose, onSuccess }) {
  const [form, setForm] = useState({ name: '', username: '', password: '', role: 'staff' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.username.trim() || !form.password.trim()) {
      setError('All fields are required.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await createUser(form.name.trim(), form.username.trim(), form.password, form.role)
      onSuccess('User created successfully.')
      onClose()
      setForm({ name: '', username: '', password: '', role: 'staff' })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add New User">
      <div className="flex flex-col gap-4">
        {error && <Alert type="error" message={error} />}
        <Field label="Full Name">
          <input className={inputCls} placeholder="e.g. Ravi Kumar" value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Username">
          <input className={inputCls} placeholder="e.g. ravi123" value={form.username} onChange={set('username')} autoCapitalize="none" />
        </Field>
        <Field label="Password">
          <input className={inputCls} type="password" placeholder="Min. 6 characters" value={form.password} onChange={set('password')} />
        </Field>
        <Field label="Role">
          <select className={inputCls} value={form.role} onChange={set('role')}>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        <div className="flex gap-3 mt-2">
          <Button variant="secondary" fullWidth onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="primary" fullWidth onClick={handleSubmit} loading={loading}>Create User</Button>
        </div>
      </div>
    </Modal>
  )
}

function EditUserModal({ open, onClose, onSuccess, user }) {
  const [form, setForm] = useState({ name: '', username: '', role: 'staff' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) setForm({ name: user.name, username: user.username, role: user.role })
  }, [user])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.username.trim()) {
      setError('Name and username are required.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await updateUser(user.id, form.name.trim(), form.username.trim(), form.role)
      onSuccess('User updated successfully.')
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit User">
      <div className="flex flex-col gap-4">
        {error && <Alert type="error" message={error} />}
        <Field label="Full Name">
          <input className={inputCls} value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Username">
          <input className={inputCls} value={form.username} onChange={set('username')} autoCapitalize="none" />
        </Field>
        <Field label="Role">
          <select className={inputCls} value={form.role} onChange={set('role')}>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        <div className="flex gap-3 mt-2">
          <Button variant="secondary" fullWidth onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="primary" fullWidth onClick={handleSubmit} loading={loading}>Save Changes</Button>
        </div>
      </div>
    </Modal>
  )
}

function ResetPasswordModal({ open, onClose, onSuccess, user }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { if (open) { setPassword(''); setConfirm(''); setError('') } }, [open])

  const handleSubmit = async () => {
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    setError('')
    try {
      await resetPassword(user.id, password)
      onSuccess('Password reset successfully.')
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Reset Password">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-500">
          Resetting password for <span className="font-semibold text-gray-800">{user?.name}</span>
        </p>
        {error && <Alert type="error" message={error} />}
        <Field label="New Password">
          <input className={inputCls} type="password" placeholder="Min. 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Confirm Password">
          <input className={inputCls} type="password" placeholder="Repeat password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <div className="flex gap-3 mt-2">
          <Button variant="secondary" fullWidth onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="primary" fullWidth onClick={handleSubmit} loading={loading}>Reset Password</Button>
        </div>
      </div>
    </Modal>
  )
}

function DeleteModal({ open, onClose, onSuccess, user }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleDelete = async () => {
    setLoading(true)
    setError('')
    try {
      await deleteUser(user.id)
      onSuccess('User deleted.')
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Delete User">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 p-4 bg-red-50 rounded-2xl">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-xl shrink-0">⚠️</div>
          <p className="text-sm text-red-700">
            Delete <span className="font-bold">{user?.name}</span>? This cannot be undone.
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

// ─── action menu ─────────────────────────────────────────────────────────────

function ActionMenu({ user, onEdit, onReset, onDelete }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-20 w-44 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            {[
              { label: 'Edit', icon: '✏️', action: onEdit },
              { label: 'Reset Password', icon: '🔑', action: onReset },
              { label: 'Delete', icon: '🗑️', action: onDelete, danger: true },
            ].map(({ label, icon, action, danger }) => (
              <button
                key={label}
                onClick={() => { setOpen(false); action(user) }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                  danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function ManageUsers() {
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [toast, setToast] = useState('')

  // modal state
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [resetTarget, setResetTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const load = async () => {
    try {
      const data = await getUsers()
      setUsers(data ?? [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const handleSuccess = (msg) => {
    showToast(msg)
    load()
  }

  const filtered = users.filter((u) => {
    const matchRole = filterRole === 'all' || u.role === filterRole
    const q = search.toLowerCase()
    const matchSearch = !q || u.name?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q)
    return matchRole && matchSearch
  })

  const admins = users.filter((u) => u.role === 'admin').length
  const staff = users.filter((u) => u.role === 'staff').length

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* ── header ── */}
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
            <h1 className="text-lg font-black text-gray-900 leading-tight">Manage Users</h1>
            <p className="text-xs text-gray-400">{users.length} total · {admins} admins · {staff} staff</p>
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

        {/* ── stat strip ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total', value: users.length, from: '#16a34a', to: '#15803d' },
            { label: 'Admins', value: admins, from: '#7c3aed', to: '#6d28d9' },
            { label: 'Staff', value: staff, from: '#0284c7', to: '#0369a1' },
          ].map(({ label, value, from, to }) => (
            <div
              key={label}
              className="relative overflow-hidden rounded-2xl p-4 shadow-sm"
              style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
            >
              <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-white/10" />
              <p className="text-2xl font-black text-white">{value}</p>
              <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* ── search + filter ── */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              placeholder="Search by name or username…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="rounded-xl border border-gray-200 bg-white text-sm text-gray-700 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
          </select>
        </div>

        {/* ── list ── */}
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3 text-center">
            <div className="w-16 h-16 rounded-3xl bg-gray-100 flex items-center justify-center text-3xl">👤</div>
            <p className="text-gray-500 font-medium">
              {search || filterRole !== 'all' ? 'No users match your filter.' : 'No users yet.'}
            </p>
            {!search && filterRole === 'all' && (
              <button onClick={() => setAddOpen(true)} className="text-brand-600 text-sm font-semibold">
                Add your first user →
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((u) => (
              <div
                key={u.id}
                className="bg-white rounded-2xl border border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm hover:shadow-md hover:border-gray-200 transition-all"
              >
                <Avatar name={u.name ?? u.username} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-gray-900 truncate">{u.name}</p>
                    {u.id === currentUser?.id && (
                      <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">You</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-gray-400">@{u.username}</p>
                    <span className="w-1 h-1 rounded-full bg-gray-300" />
                    <RoleBadge role={u.role} />
                  </div>
                </div>
                {u.id !== currentUser?.id && (
                  <ActionMenu
                    user={u}
                    onEdit={setEditTarget}
                    onReset={setResetTarget}
                    onDelete={setDeleteTarget}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── modals ── */}
      <AddUserModal open={addOpen} onClose={() => setAddOpen(false)} onSuccess={handleSuccess} />
      <EditUserModal open={!!editTarget} onClose={() => setEditTarget(null)} onSuccess={handleSuccess} user={editTarget} />
      <ResetPasswordModal open={!!resetTarget} onClose={() => setResetTarget(null)} onSuccess={handleSuccess} user={resetTarget} />
      <DeleteModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onSuccess={handleSuccess} user={deleteTarget} />

      {/* ── toast ── */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 whitespace-nowrap">
          <span className="text-brand-400">✓</span> {toast}
        </div>
      )}
    </div>
  )
}