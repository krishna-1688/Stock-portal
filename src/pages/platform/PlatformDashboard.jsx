import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '../../components/ui/modal'
import Button from '../../components/ui/button'
import Spinner from '../../components/ui/spinner'
import Alert from '../../components/ui/alert'
import {
  platformValidateSession,
  platformLogout,
  listShops,
  createShop,
  updateShop,
  getShopUsers,
  createShopUser,
  resetShopUserPassword,
  setShopUserActive,
} from '../../services/platformService'
import { clearPlatformToken, getPlatformToken } from '../../utils/session'

// ─── helpers ────────────────────────────────────────────────────────────────

const TIMEZONES = (() => {
  try { return Intl.supportedValuesOf('timeZone') } catch { return ['Asia/Kolkata', 'Asia/Colombo', 'Asia/Dubai', 'Asia/Singapore', 'UTC'] }
})()

const ROLE_META = {
  super_admin: { label: 'Super Admin', cls: 'bg-amber-100 text-amber-700' },
  admin: { label: 'Admin', cls: 'bg-violet-100 text-violet-700' },
  staff: { label: 'Staff', cls: 'bg-sky-100 text-sky-700' },
}

const slugify = (s) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent focus:bg-white transition-all'

function Field({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

function formatDate(ts) {
  if (!ts) return 'Never'
  return new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── create shop ────────────────────────────────────────────────────────────

const EMPTY_SHOP = {
  name: '', code: '', timezone: 'Asia/Kolkata', supportContact: '',
  adminName: '', adminUsername: '', adminPassword: '',
}

function CreateShopModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY_SHOP)
  const [codeTouched, setCodeTouched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) { setForm(EMPTY_SHOP); setCodeTouched(false); setError('') }
  }, [open])

  const set = (k) => (e) => {
    const value = e.target.value
    setForm((f) => {
      const next = { ...f, [k]: value }
      if (k === 'name' && !codeTouched) next.code = slugify(value)
      return next
    })
    if (k === 'code') setCodeTouched(true)
  }

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.code.trim()) { setError('Shop name and code are required.'); return }
    if (!form.adminName.trim() || !form.adminUsername.trim()) { setError('Super admin name and username are required.'); return }
    if (form.adminPassword.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true); setError('')
    try {
      await createShop({ ...form, code: slugify(form.code) })
      onCreated(`Shop "${form.name.trim()}" created. Super admin can log in as "${form.adminUsername.trim().toLowerCase()}".`)
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Shop">
      <div className="flex flex-col gap-4">
        {error && <Alert type="error" message={error} />}
        <Field label="Shop Name">
          <input className={inputCls} placeholder="e.g. Lakshmi Stores" value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Shop Code" hint="Short unique id: lowercase letters, numbers, dashes.">
          <input className={inputCls} value={form.code} onChange={set('code')} autoCapitalize="none" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Timezone">
            <select className={inputCls} value={form.timezone} onChange={set('timezone')}>
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </Field>
          <Field label="Support Contact">
            <input className={inputCls} placeholder="Name or phone" value={form.supportContact} onChange={set('supportContact')} />
          </Field>
        </div>

        <div className="h-px bg-slate-100 my-1" />
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">First Super Admin</p>
        <Field label="Full Name">
          <input className={inputCls} value={form.adminName} onChange={set('adminName')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Username">
            <input className={inputCls} value={form.adminUsername} onChange={set('adminUsername')} autoCapitalize="none" />
          </Field>
          <Field label="Password">
            <input className={inputCls} type="password" placeholder="Min. 6 characters" value={form.adminPassword} onChange={set('adminPassword')} />
          </Field>
        </div>

        <div className="flex gap-3 mt-2">
          <Button variant="secondary" fullWidth onClick={onClose} disabled={loading}>Cancel</Button>
          <Button fullWidth onClick={handleSubmit} loading={loading}>Create Shop</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── shop detail ────────────────────────────────────────────────────────────

function UserRow({ user, onChanged }) {
  const [resetOpen, setResetOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const role = ROLE_META[user.role] ?? { label: user.role, cls: 'bg-slate-100 text-slate-600' }

  const run = async (fn, msg) => {
    setBusy(true); setError('')
    try { await fn(); onChanged(msg) } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const handleReset = () => {
    if (password.length < 6) { setError('Min. 6 characters.'); return }
    run(() => resetShopUserPassword(user.id, password), `Password reset for ${user.username}.`)
      .then(() => { setResetOpen(false); setPassword('') })
  }

  const handleToggle = () => {
    const verb = user.is_active ? 'Deactivate' : 'Reactivate'
    if (!window.confirm(`${verb} ${user.name} (${user.username})?`)) return
    run(() => setShopUserActive(user.id, !user.is_active), `${user.username} ${user.is_active ? 'deactivated' : 'reactivated'}.`)
  }

  return (
    <div className={`py-3 ${user.is_active ? '' : 'opacity-60'}`}>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 truncate">{user.name}</p>
          <p className="text-xs text-slate-400 truncate">@{user.username}{user.is_active ? '' : ' · inactive'}</p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${role.cls}`}>{role.label}</span>
      </div>
      <div className="flex gap-3 mt-2">
        <button onClick={() => setResetOpen((v) => !v)} className="text-xs font-semibold text-brand-700 hover:underline" disabled={busy}>
          Reset password
        </button>
        <button onClick={handleToggle} className="text-xs font-semibold text-slate-500 hover:underline" disabled={busy}>
          {user.is_active ? 'Deactivate' : 'Reactivate'}
        </button>
      </div>
      {resetOpen && (
        <div className="flex gap-2 mt-2">
          <input className={`${inputCls} py-2`} type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button size="sm" onClick={handleReset} loading={busy}>Save</Button>
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}

function AddUserForm({ shopId, onAdded }) {
  const [form, setForm] = useState({ name: '', username: '', password: '', role: 'super_admin' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.username.trim()) { setError('Name and username are required.'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true); setError('')
    try {
      await createShopUser(shopId, form)
      onAdded(`User "${form.username.trim().toLowerCase()}" added.`)
      setForm({ name: '', username: '', password: '', role: 'super_admin' })
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col gap-2 bg-slate-50 rounded-2xl p-3">
      {error && <Alert type="error" message={error} />}
      <div className="grid grid-cols-2 gap-2">
        <input className={`${inputCls} bg-white`} placeholder="Full name" value={form.name} onChange={set('name')} />
        <input className={`${inputCls} bg-white`} placeholder="Username" value={form.username} onChange={set('username')} autoCapitalize="none" />
        <input className={`${inputCls} bg-white`} type="password" placeholder="Password" value={form.password} onChange={set('password')} />
        <select className={`${inputCls} bg-white`} value={form.role} onChange={set('role')}>
          <option value="super_admin">Super Admin</option>
          <option value="admin">Admin</option>
          <option value="staff">Staff</option>
        </select>
      </div>
      <Button size="sm" onClick={handleSubmit} loading={loading}>Add User</Button>
    </div>
  )
}

function ShopModal({ shop, onClose, onChanged }) {
  const [form, setForm] = useState(null)
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const loadUsers = useCallback(async (shopId) => {
    setLoadingUsers(true)
    try { setUsers((await getShopUsers(shopId)) ?? []) } catch (e) { setError(e.message) } finally { setLoadingUsers(false) }
  }, [])

  // reset only when a different shop is opened, not on every list refresh
  useEffect(() => {
    if (!shop) return
    setForm({ name: shop.name, timezone: shop.timezone, supportContact: shop.support_contact ?? '' })
    setError(''); setNotice(''); setShowAdd(false)
    loadUsers(shop.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop?.id, loadUsers])

  if (!shop || !form) return null

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async (isActive) => {
    setSaving(true); setError('')
    try {
      await updateShop(shop.id, { ...form, isActive })
      onChanged(isActive === shop.is_active ? 'Shop updated.' : isActive ? 'Shop reactivated.' : 'Shop suspended. All its users were logged out.')
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  const handleSuspendToggle = () => {
    if (shop.is_active) {
      const typed = window.prompt(`Suspending "${shop.name}" logs out all its users and blocks their login.\n\nType the shop code "${shop.code}" to confirm:`)
      if (typed !== shop.code) return
    }
    save(!shop.is_active)
  }

  const userChanged = (msg) => { setNotice(msg); loadUsers(shop.id); onChanged(null) }

  return (
    <Modal open={!!shop} onClose={onClose} title={shop.name}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 -mt-2">
          <span className="text-xs font-mono text-slate-400">{shop.code}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${shop.is_active ? 'bg-brand-100 text-brand-700' : 'bg-red-100 text-red-700'}`}>
            {shop.is_active ? 'Active' : 'Suspended'}
          </span>
        </div>
        {error && <Alert type="error" message={error} />}
        {notice && <Alert type="success" message={notice} />}

        <Field label="Shop Name">
          <input className={inputCls} value={form.name} onChange={set('name')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Timezone">
            <select className={inputCls} value={form.timezone} onChange={set('timezone')}>
              {TIMEZONES.includes(form.timezone) ? null : <option value={form.timezone}>{form.timezone}</option>}
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </Field>
          <Field label="Support Contact">
            <input className={inputCls} value={form.supportContact} onChange={set('supportContact')} />
          </Field>
        </div>
        <div className="flex gap-3">
          <Button variant={shop.is_active ? 'danger' : 'secondary'} fullWidth onClick={handleSuspendToggle} disabled={saving}>
            {shop.is_active ? 'Suspend' : 'Reactivate'}
          </Button>
          <Button fullWidth onClick={() => save(shop.is_active)} loading={saving}>Save</Button>
        </div>

        <div className="h-px bg-slate-100" />
        <div className="flex items-center justify-between">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Users ({users.length})</p>
          <button onClick={() => setShowAdd((v) => !v)} className="text-xs font-bold text-brand-700">
            {showAdd ? 'Close' : '+ Add user'}
          </button>
        </div>
        {showAdd && <AddUserForm shopId={shop.id} onAdded={userChanged} />}
        {loadingUsers ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : (
          <div className="divide-y divide-slate-100">
            {users.map((u) => <UserRow key={u.id} user={u} onChanged={userChanged} />)}
            {users.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">No users yet.</p>}
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── page ───────────────────────────────────────────────────────────────────

function ShopCard({ shop, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-3xl border border-slate-100 shadow-sm p-5 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.99] transition-all"
    >
      <div className="flex items-start gap-3">
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white font-black shrink-0 ${shop.is_active ? 'bg-gradient-to-br from-brand-500 to-brand-700' : 'bg-slate-300'}`}>
          {shop.name.trim()[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[15px] font-black text-slate-900 truncate">{shop.name}</p>
            {!shop.is_active && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 shrink-0">Suspended</span>}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            <span className="font-mono">{shop.code}</span> · {shop.timezone} · last stock {formatDate(shop.last_submission_at)}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-2 mt-4">
        {[
          ['Super', shop.super_admins],
          ['Admins', shop.admins],
          ['Staff', shop.staff],
          ['Agencies', shop.agencies],
          ['Stock', shop.submissions],
        ].map(([label, value]) => (
          <div key={label} className="bg-slate-50 rounded-xl py-2 text-center">
            <p className="text-sm font-black text-slate-800">{value}</p>
            <p className="text-[10px] text-slate-400 font-semibold">{label}</p>
          </div>
        ))}
      </div>
    </button>
  )
}

export default function PlatformDashboard() {
  const navigate = useNavigate()
  const [owner, setOwner] = useState(null)
  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [toast, setToast] = useState('')
  const [search, setSearch] = useState('')

  const signOut = useCallback(() => {
    clearPlatformToken()
    navigate('/platform/login', { replace: true })
  }, [navigate])

  const loadShops = useCallback(async () => {
    try { setShops((await listShops()) ?? []) }
    catch (e) { if (/session|logged in/i.test(e.message)) signOut(); else setToast(e.message) }
    finally { setLoading(false) }
  }, [signOut])

  useEffect(() => {
    if (!getPlatformToken()) { signOut(); return }
    platformValidateSession()
      .then((o) => { if (!o) throw new Error('Session expired'); setOwner(o); return loadShops() })
      .catch(signOut)
  }, [loadShops, signOut])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500) }
  const handleChanged = (msg) => { if (msg) showToast(msg); loadShops() }

  const handleLogout = async () => {
    await platformLogout().catch(() => {})
    signOut()
  }

  const selected = shops.find((s) => s.id === selectedId) ?? null
  const filtered = shops.filter((s) => !search || `${s.name} ${s.code}`.toLowerCase().includes(search.toLowerCase()))
  const totals = shops.reduce((t, s) => ({
    active: t.active + (s.is_active ? 1 : 0),
    users: t.users + Number(s.super_admins) + Number(s.admins) + Number(s.staff),
    submissions: t.submissions + Number(s.submissions),
  }), { active: 0, users: 0, submissions: 0 })

  if (!owner) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Spinner /></div>
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <div className="bg-slate-950 text-white">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <div>
            <p className="text-sm font-black leading-none">Stock Portal Platform</p>
            <p className="text-xs text-slate-400 leading-none mt-1">Signed in as {owner.name}</p>
          </div>
          <button onClick={handleLogout} className="text-xs font-bold text-slate-300 hover:text-white px-3 py-2 rounded-xl hover:bg-slate-800 transition-colors">
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-5 flex flex-col gap-4">
        <div className="grid grid-cols-4 gap-3">
          {[
            ['Shops', shops.length],
            ['Active', totals.active],
            ['Users', totals.users],
            ['Stock entries', totals.submissions],
          ].map(([label, value]) => (
            <div key={label} className="bg-white rounded-2xl border border-slate-100 p-3 shadow-sm">
              <p className="text-xl font-black text-slate-900">{value}</p>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            className="flex-1 min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Search shops…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            onClick={() => setCreateOpen(true)}
            className="shrink-0 bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-sm shadow-brand-600/30 active:scale-95 transition-all"
          >
            + New Shop
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-16">{search ? 'No shops match.' : 'No shops yet.'}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((s) => <ShopCard key={s.id} shop={s} onClick={() => setSelectedId(s.id)} />)}
          </div>
        )}
      </div>

      <CreateShopModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleChanged} />
      <ShopModal shop={selected} onClose={() => setSelectedId(null)} onChanged={handleChanged} />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl max-w-[90vw]">
          {toast}
        </div>
      )}
    </div>
  )
}
