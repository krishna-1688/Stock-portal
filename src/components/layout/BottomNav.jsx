import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/authContext'

function NavItem({ to, label, icon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center gap-1 px-4 py-2 text-xs font-medium transition-all ${
          isActive ? 'text-brand-600' : 'text-gray-400 hover:text-gray-600'
        }`
      }
    >
      <span className="text-xl">{icon}</span>
      <span>{label}</span>
    </NavLink>
  )
}

export default function BottomNav() {
  const { user } = useAuth()

  if (user?.role === 'staff') {
    return (
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
        <div className="max-w-2xl mx-auto flex justify-around">
          <NavItem to="/staff/agencies" label="Home" icon="🏠" />
          {/* 👇 Added the History button right here 👇 */}
          <NavItem to="/staff/history" label="History" icon="🕒" />
        </div>
      </nav>
    )
  }

  if (user?.role === 'admin') {
    return (
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
        <div className="max-w-2xl mx-auto flex justify-around">
          <NavItem to="/admin/dashboard" label="Dashboard" icon="📊" />
          <NavItem to="/admin/agencies"  label="Agencies"  icon="🏪"/>
          <NavItem to="/admin/status" label="Status" icon="✅" />
          <NavItem to="/admin/history" label="History" icon="📋" />
        </div>
      </nav>
    )
  }

  if (user?.role === 'super_admin') {
    return (
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
        <div className="max-w-2xl mx-auto flex justify-around">
          <NavItem to="/super/dashboard" label="Dashboard" icon="📊" />
          <NavItem to="/super/users" label="Users" icon="👥" />
          <NavItem to="/super/agencies" label="Agencies" icon="🏪" />
          <NavItem to="/super/products" label="Products" icon="📦" />
        </div>
      </nav>
    )
  }

  return null
}