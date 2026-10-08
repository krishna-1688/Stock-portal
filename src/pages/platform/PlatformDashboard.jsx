import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

// ─── shared bits ─────────────────────────────────────────────────────────────

const TIMEZONES = (() => {
  try { return Intl.supportedValuesOf('timeZone') } catch { return ['Asia/Kolkata', 'Asia/Colombo', 'Asia/Dubai', 'Asia/Singapore', 'UTC'] }
})()

const ROLE_META = {
  super_admin: { label: 'Super Admin', cls: 'bg-amber-50 text-amber-700' },
  admin: { label: 'Admin', cls: 'bg-violet-50 text-violet-700' },
  staff: { label: 'Staff', cls: 'bg-sky-50 text-sky-700' },
}

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent focus:bg-white transition-all'
const btnPrimary = 'inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-all active:scale-[0.98] disabled:opacity-60'
const btnSecondary = 'inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-xl transition-all active:scale-[0.98] disabled:opacity-60'
const btnDanger = 'inline-flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-all active:scale-[0.98] disabled:opacity-60'

const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)

function timeAgo(ts) {
  if (!ts) return 'No stock yet'
  const mins = Math.round((Date.now() - new Date(ts)) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} h ago`
  const days = Math.round(hrs / 24)
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const Icon = {
  building: <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />,
  check: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
  users: <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />,
  clipboard: <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />,
  plus: <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />,
  search: <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />,
  logout: <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />,
  close: <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />,
  chevron: <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />,
  key: <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />,
}
const Svg = ({ d, className = 'w-4 h-4', strokeWidth = 2 }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth}>{d}</svg>
)

function Field({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

// Bottom sheet on phones, side panel on laptops.
function Sheet({ open, onClose, title, subtitle, children, footer }) {
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey) }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-stretch lg:justify-end">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative w-full lg:w-[460px] max-h-[92vh] lg:max-h-none bg-white rounded-t-3xl lg:rounded-none shadow-2xl flex flex-col">
        <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-slate-900 truncate">{title}</h2>
            {subtitle && <div className="text-xs text-slate-400 mt-0.5">{subtitle}</div>}
          </div>
          <button onClick={onClose} aria-label="Close"
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 shrink-0 transition-colors">
            <Svg d={Icon.close} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-slate-100">{footer}</div>}
      </div>
    </div>
  )
}

function ConfirmDialog({ open, title, message, confirmLabel, danger, requireText, busy, onConfirm, onCancel }) {
  const [typed, setTyped] = useState('')
  if (!open) return null
  const blocked = requireText && typed !== requireText
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onCancel} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-sm p-6 shadow-xl">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">{message}</p>
        {requireText && (
          <div className="mt-4">
            <Field label={`Type "${requireText}" to confirm`}>
              <input className={inputCls} value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="none" autoFocus />
            </Field>
          </div>
        )}
        <div className="flex gap-2 mt-5">
          <button className={`${btnSecondary} flex-1`} onClick={() => { setTyped(''); onCancel() }} disabled={busy}>Cancel</button>
          <button className={`${danger ? btnDanger : btnPrimary} flex-1`} disabled={busy || blocked}
            onClick={async () => { await onConfirm(); setTyped('') }}>
            {busy ? <Spinner size="sm" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── create shop ────────────────────────────────────────────────────────────

const EMPTY_SHOP = { name: '', code: '', timezone: 'Asia/Kolkata', supportContact: '', adminName: '', adminUsername: '', adminPassword: '' }

function CreateShopSheet({ open, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY_SHOP)
  const [codeTouched, setCodeTouched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const close = () => { setForm(EMPTY_SHOP); setCodeTouched(false); setError(''); onClose() }

  const set = (k) => (e) => {
    const value = e.target.value
    if (k === 'code') setCodeTouched(true)
    setForm((f) => ({ ...f, [k]: value, ...(k === 'name' && !codeTouched ? { code: slugify(value) } : {}) }))
  }

  const submit = async () => {
    if (!form.name.trim() || !form.code.trim()) { setError('Shop name and code are required.'); return }
    if (!form.adminName.trim() || !form.adminUsername.trim()) { setError('Super admin name and username are required.'); return }
    if (form.adminPassword.length < 8) { setError('Use a password of at least 8 characters.'); return }
    setLoading(true); setError('')
    try {
      await createShop({ ...form, code: slugify(form.code) })
      onCreated(`"${form.name.trim()}" created. Super admin signs in as "${form.adminUsername.trim().toLowerCase()}".`)
      close()
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <Sheet open={open} onClose={close} title="New shop" subtitle="Creates the shop and its first super admin"
      footer={
        <div className="flex gap-2">
          <button className={`${btnSecondary} flex-1`} onClick={close} disabled={loading}>Cancel</button>
          <button className={`${btnPrimary} flex-1`} onClick={submit} disabled={loading}>{loading ? <Spinner size="sm" /> : 'Create shop'}</button>
        </div>
      }>
      <div className="flex flex-col gap-4">
        {error && <Alert type="error" message={error} />}
        <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">Shop</p>
        <Field label="Shop name">
          <input className={inputCls} placeholder="e.g. Lakshmi Stores" value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Shop code" hint="Short unique id — lowercase letters, numbers, dashes.">
          <input className={`${inputCls} font-mono`} value={form.code} onChange={set('code')} autoCapitalize="none" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Timezone">
            <select className={inputCls} value={form.timezone} onChange={set('timezone')}>
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </Field>
          <Field label="Support contact" hint="Shown on the login page.">
            <input className={inputCls} placeholder="Name or phone" value={form.supportContact} onChange={set('supportContact')} />
          </Field>
        </div>

        <div className="h-px bg-slate-100 my-1" />
        <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">First super admin</p>
        <Field label="Full name">
          <input className={inputCls} value={form.adminName} onChange={set('adminName')} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Username" hint="Must be unique across all shops.">
            <input className={inputCls} value={form.adminUsername} onChange={set('adminUsername')} autoCapitalize="none" autoComplete="off" />
          </Field>
          <Field label="Password" hint="At least 8 characters.">
            <input className={inputCls} type="password" value={form.adminPassword} onChange={set('adminPassword')} autoComplete="new-password" />
          </Field>
        </div>
      </div>
    </Sheet>
  )
}

// ─── shop detail ────────────────────────────────────────────────────────────

function UserRow({ user, onChanged, onConfirm }) {
  const [resetOpen, setResetOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const role = ROLE_META[user.role] ?? { label: user.role, cls: 'bg-slate-100 text-slate-600' }

  const reset = async () => {
    if (password.length < 8) { setError('At least 8 characters.'); return }
    setBusy(true); setError('')
    try {
      await resetShopUserPassword(user.id, password)
      setResetOpen(false); setPassword('')
      onChanged(`Password reset for ${user.username}. They were logged out everywhere.`)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const toggle = () => onConfirm({
    title: user.is_active ? `Deactivate ${user.name}?` : `Reactivate ${user.name}?`,
    message: user.is_active
      ? `@${user.username} will be logged out and won't be able to sign in until reactivated.`
      : `@${user.username} will be able to sign in again.`,
    confirmLabel: user.is_active ? 'Deactivate' : 'Reactivate',
    danger: user.is_active,
    action: async () => {
      await setShopUserActive(user.id, !user.is_active)
      onChanged(`${user.username} ${user.is_active ? 'deactivated' : 'reactivated'}.`)
    },
  })

  return (
    <div className={`py-3 ${user.is_active ? '' : 'opacity-60'}`}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600 shrink-0">
          {user.name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">{user.name}</p>
          <p className="text-xs text-slate-400 truncate">@{user.username}{user.is_active ? '' : ' · inactive'}</p>
        </div>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${role.cls}`}>{role.label}</span>
      </div>
      <div className="flex gap-4 mt-2 pl-12">
        <button onClick={() => { setResetOpen((v) => !v); setError('') }} className="text-xs font-medium text-brand-600 hover:underline">Reset password</button>
        <button onClick={toggle} className="text-xs font-medium text-slate-500 hover:underline">{user.is_active ? 'Deactivate' : 'Reactivate'}</button>
      </div>
      {resetOpen && (
        <div className="flex gap-2 mt-2 pl-12">
          <input className={inputCls} type="password" placeholder="New password" value={password}
            onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          <button className={btnPrimary} onClick={reset} disabled={busy}>{busy ? <Spinner size="sm" /> : 'Save'}</button>
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-1 pl-12">{error}</p>}
    </div>
  )
}

function AddUserForm({ shopId, onAdded, onCancel }) {
  const [form, setForm] = useState({ name: '', username: '', password: '', role: 'super_admin' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async () => {
    if (!form.name.trim() || !form.username.trim()) { setError('Name and username are required.'); return }
    if (form.password.length < 8) { setError('Use a password of at least 8 characters.'); return }
    setLoading(true); setError('')
    try {
      await createShopUser(shopId, form)
      onAdded(`User "${form.username.trim().toLowerCase()}" added.`)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col gap-3 bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-2">
      {error && <Alert type="error" message={error} />}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input className={`${inputCls} bg-white`} placeholder="Full name" value={form.name} onChange={set('name')} />
        <input className={`${inputCls} bg-white`} placeholder="Username" value={form.username} onChange={set('username')} autoCapitalize="none" autoComplete="off" />
        <input className={`${inputCls} bg-white`} type="password" placeholder="Password (8+ characters)" value={form.password} onChange={set('password')} autoComplete="new-password" />
        <select className={`${inputCls} bg-white`} value={form.role} onChange={set('role')}>
          <option value="super_admin">Super Admin</option>
          <option value="admin">Admin</option>
          <option value="staff">Staff</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button className={`${btnSecondary} flex-1`} onClick={onCancel} disabled={loading}>Cancel</button>
        <button className={`${btnPrimary} flex-1`} onClick={submit} disabled={loading}>{loading ? <Spinner size="sm" /> : 'Add user'}</button>
      </div>
    </div>
  )
}

function ShopSheet({ shop, onClose, onChanged, onConfirm }) {
  const [tab, setTab] = useState('details')
  const [form, setForm] = useState(null)
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const loadUsers = useCallback(async (shopId) => {
    setLoadingUsers(true)
    try { setUsers((await getShopUsers(shopId)) ?? []) } catch (e) { setError(e.message) } finally { setLoadingUsers(false) }
  }, [])

  // reset only when a different shop is opened, not on every list refresh
  useEffect(() => {
    if (!shop) return
    setTab('details'); setError(''); setShowAdd(false)
    setForm({ name: shop.name, timezone: shop.timezone, supportContact: shop.support_contact ?? '' })
    loadUsers(shop.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop?.id, loadUsers])

  if (!shop || !form) return null
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    setSaving(true); setError('')
    try { await updateShop(shop.id, { ...form, isActive: shop.is_active }); onChanged('Shop details saved.') }
    catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  const toggleActive = () => onConfirm({
    title: shop.is_active ? `Suspend ${shop.name}?` : `Reactivate ${shop.name}?`,
    message: shop.is_active
      ? 'All of its users are logged out immediately and cannot sign in until you reactivate it. No data is deleted.'
      : 'Its users will be able to sign in again.',
    confirmLabel: shop.is_active ? 'Suspend shop' : 'Reactivate',
    danger: shop.is_active,
    requireText: shop.is_active ? shop.code : null,
    action: async () => {
      await updateShop(shop.id, { ...form, isActive: !shop.is_active })
      onChanged(shop.is_active ? 'Shop suspended. Its users were logged out.' : 'Shop reactivated.')
    },
  })

  const userChanged = (msg) => { setShowAdd(false); loadUsers(shop.id); onChanged(msg) }
  const activeUsers = users.filter((u) => u.is_active).length

  const tabCls = (t) => `flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`

  return (
    <Sheet open={!!shop} onClose={onClose} title={shop.name}
      subtitle={
        <span className="inline-flex items-center gap-2">
          <span className="font-mono">{shop.code}</span>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${shop.is_active ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-red-600'}`}>
            {shop.is_active ? 'Active' : 'Suspended'}
          </span>
        </span>
      }>
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-4">
        <button className={tabCls('details')} onClick={() => setTab('details')}>Details</button>
        <button className={tabCls('users')} onClick={() => setTab('users')}>Users ({users.length})</button>
      </div>
      {error && <div className="mb-4"><Alert type="error" message={error} /></div>}

      {tab === 'details' ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2">
            {[['Agencies', shop.agencies], ['Products', shop.products], ['Stock entries', shop.submissions]].map(([l, v]) => (
              <div key={l} className="bg-slate-50 rounded-xl px-3 py-2.5">
                <p className="text-base font-semibold text-slate-900">{Number(v).toLocaleString('en-IN')}</p>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{l}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400">Created {new Date(shop.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · Last stock {timeAgo(shop.last_submission_at).toLowerCase()}</p>

          <Field label="Shop name"><input className={inputCls} value={form.name} onChange={set('name')} /></Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Timezone">
              <select className={inputCls} value={form.timezone} onChange={set('timezone')}>
                {!TIMEZONES.includes(form.timezone) && <option value={form.timezone}>{form.timezone}</option>}
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </Field>
            <Field label="Support contact"><input className={inputCls} value={form.supportContact} onChange={set('supportContact')} /></Field>
          </div>
          <button className={btnPrimary} onClick={save} disabled={saving}>{saving ? <Spinner size="sm" /> : 'Save changes'}</button>

          <div className="mt-2 rounded-2xl border border-red-100 bg-red-50/40 p-4">
            <p className="text-sm font-medium text-slate-900">{shop.is_active ? 'Suspend shop' : 'Shop is suspended'}</p>
            <p className="text-xs text-slate-500 mt-1">
              {shop.is_active ? 'Blocks all its users from signing in. Data is kept.' : 'Its users cannot sign in.'}
            </p>
            <button className={`${shop.is_active ? btnDanger : btnSecondary} mt-3`} onClick={toggleActive}>
              {shop.is_active ? 'Suspend' : 'Reactivate shop'}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">{activeUsers} active</p>
            {!showAdd && (
              <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600">
                <Svg d={Icon.plus} className="w-3.5 h-3.5" strokeWidth={2.5} /> Add user
              </button>
            )}
          </div>
          {showAdd && <AddUserForm shopId={shop.id} onAdded={userChanged} onCancel={() => setShowAdd(false)} />}
          {loadingUsers ? <div className="flex justify-center py-8"><Spinner /></div> : (
            <div className="divide-y divide-slate-100">
              {users.map((u) => <UserRow key={u.id} user={u} onChanged={userChanged} onConfirm={onConfirm} />)}
              {users.length === 0 && <p className="text-sm text-slate-400 py-6 text-center">No users yet.</p>}
            </div>
          )}
        </div>
      )}
    </Sheet>
  )
}

// ─── page ───────────────────────────────────────────────────────────────────

function ShopCard({ shop, onClick }) {
  const users = Number(shop.super_admins) + Number(shop.admins) + Number(shop.staff)
  return (
    <button onClick={onClick}
      className="group bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md active:scale-[0.99] transition-all w-full text-left">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-semibold shrink-0 ${shop.is_active ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-400'}`}>
          {shop.name.trim()[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-900 truncate">{shop.name}</p>
            {!shop.is_active && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600 shrink-0">Suspended</span>}
          </div>
          <p className="text-xs text-slate-400 mt-0.5 truncate"><span className="font-mono">{shop.code}</span> · {timeAgo(shop.last_submission_at)}</p>
        </div>
        <Svg d={Icon.chevron} className="w-4 h-4 text-slate-300 group-hover:text-brand-600 transition-colors shrink-0" strokeWidth={2.5} />
      </div>
      <div className="grid grid-cols-4 gap-2 mt-3">
        {[['Users', users], ['Agencies', shop.agencies], ['Products', shop.products], ['Entries', shop.submissions]].map(([l, v]) => (
          <div key={l} className="bg-slate-50 rounded-xl py-2 text-center">
            <p className="text-sm font-semibold text-slate-800">{Number(v).toLocaleString('en-IN')}</p>
            <p className="text-[10px] text-slate-400">{l}</p>
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
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [toast, setToast] = useState('')

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

  const runConfirm = async () => {
    setConfirmBusy(true)
    try { await confirm.action(); setConfirm(null) }
    catch (e) { showToast(e.message) }
    finally { setConfirmBusy(false) }
  }

  const handleLogout = async () => { await platformLogout().catch(() => {}); signOut() }

  if (!owner) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Spinner /></div>

  const selected = shops.find((s) => s.id === selectedId) ?? null
  const filtered = shops.filter((s) =>
    (status === 'all' || (status === 'active' ? s.is_active : !s.is_active)) &&
    (!search || `${s.name} ${s.code}`.toLowerCase().includes(search.toLowerCase())))
  const totals = shops.reduce((t, s) => ({
    active: t.active + (s.is_active ? 1 : 0),
    users: t.users + Number(s.super_admins) + Number(s.admins) + Number(s.staff),
    entries: t.entries + Number(s.submissions),
  }), { active: 0, users: 0, entries: 0 })
  const stats = [
    { label: 'Shops', value: shops.length, color: '#1B5E37', icon: Icon.building },
    { label: 'Active', value: totals.active, color: '#2563EB', icon: Icon.check },
    { label: 'Users', value: totals.users, color: '#D97706', icon: Icon.users },
    { label: 'Stock entries', value: totals.entries, color: '#7C3AED', icon: Icon.clipboard },
  ]
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const chip = (active) => `shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-all ${active ? 'bg-brand-600 text-white' : 'bg-white text-slate-500 border border-slate-100 hover:border-slate-200'}`

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-lg lg:max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white">
              <Svg d={Icon.building} strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 leading-none">Stock Portal</p>
              <p className="text-xs text-slate-400 leading-none mt-0.5">Platform owner</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-medium text-slate-700">{owner.name}</p>
              <p className="text-xs text-brand-600">@{owner.username}</p>
            </div>
            <button onClick={handleLogout} title="Logout" aria-label="Logout"
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-500 flex items-center justify-center text-slate-500 transition-colors">
              <Svg d={Icon.logout} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg lg:max-w-5xl mx-auto px-4 pb-16 pt-5">
        <div className="mb-5">
          <p className="text-xs text-slate-400">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <p className="text-xl font-semibold text-slate-900 mt-1">{greeting}, {owner.name.split(' ')[0]}</p>
        </div>

        <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-3">Overview</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {stats.map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ background: s.color }} />
              <div className="flex items-start justify-between">
                <p className="text-2xl font-semibold text-slate-900">{s.value.toLocaleString('en-IN')}</p>
                <span style={{ color: s.color }} className="opacity-70"><Svg d={s.icon} className="w-4 h-4" /></span>
              </div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">Shops</p>
          <button onClick={() => setCreateOpen(true)} className={`${btnPrimary} py-2`}>
            <Svg d={Icon.plus} className="w-4 h-4" strokeWidth={2.5} /> New shop
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Svg d={Icon.search} /></span>
            <input className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-100 bg-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent"
              placeholder="Search by name or code" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {[['all', 'All'], ['active', 'Active'], ['suspended', 'Suspended']].map(([k, l]) => (
              <button key={k} onClick={() => setStatus(k)} className={chip(status === k)}>{l}</button>
            ))}
          </div>
        </div>

        {loading ? <div className="flex justify-center py-16"><Spinner /></div>
        : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <div className="w-14 h-14 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-400"><Svg d={Icon.building} className="w-6 h-6" strokeWidth={1.5} /></div>
            <p className="text-slate-400 text-sm">{search || status !== 'all' ? 'No shops match.' : 'No shops yet.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {filtered.map((s) => <ShopCard key={s.id} shop={s} onClick={() => setSelectedId(s.id)} />)}
          </div>
        )}
      </div>

      <CreateShopSheet open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleChanged} />
      <ShopSheet shop={selected} onClose={() => setSelectedId(null)} onChanged={handleChanged} onConfirm={setConfirm} />
      <ConfirmDialog open={!!confirm} {...(confirm ?? {})} busy={confirmBusy} onConfirm={runConfirm} onCancel={() => setConfirm(null)} />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg max-w-[90vw] text-center">
          {toast}
        </div>
      )}
    </div>
  )
}
