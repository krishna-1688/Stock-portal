import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/authContext'

function NavItem({ to, label, icon }) {
  return (
    <NavLink to={to} className={({ isActive }) =>
      `flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${isActive ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600'}`
    }>
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </NavLink>
  )
}

const homeIcon = <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path strokeLinecap="round" strokeLinejoin="round" d="M9 22V12h6v10"/></svg>
const historyIcon = <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
const usersIcon = <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
const agencyIcon = <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
const productIcon = <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
const dashIcon = <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>

export default function BottomNav() {
  const { user } = useAuth()

  const navWrap = (children) => (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 z-40">
      <div className="max-w-2xl mx-auto flex justify-around px-2 py-1">{children}</div>
    </nav>
  )

  if (user?.role === 'staff') return navWrap(<>
    <NavItem to="/staff/agencies" label="Home" icon={homeIcon} />
    <NavItem to="/staff/history" label="History" icon={historyIcon} />
  </>)

  if (user?.role === 'admin') return navWrap(<>
    <NavItem to="/admin/dashboard" label="Dashboard" icon={dashIcon} />
    <NavItem to="/admin/agencies"  label="Agencies"  icon={agencyIcon} />
    <NavItem to="/admin/status"    label="Status"    icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>} />
    <NavItem to="/admin/history"   label="History"   icon={historyIcon} />
  </>)

  if (user?.role === 'super_admin') return navWrap(<>
    <NavItem to="/super/dashboard" label="Dashboard" icon={dashIcon} />
    <NavItem to="/super/users"     label="Users"     icon={usersIcon} />
    <NavItem to="/super/agencies"  label="Agencies"  icon={agencyIcon} />
    <NavItem to="/super/products"  label="Products"  icon={productIcon} />
  </>)

  return null
}
