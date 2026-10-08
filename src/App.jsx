import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/authContext.jsx'
import { signInPath } from './utils/session'

import Login from './pages/Login.jsx'
import Demo from './pages/Demo.jsx'

// Staff
import StaffSubmissionDetail from './pages/staff/StaffSubmissionDetail.jsx'
import AgencyList from './pages/staff/AgencyList.jsx'
import StockEntry from './pages/staff/StockEntry.jsx'
import SubmissionHistory from './pages/staff/SubmissionHistory.jsx'

// Admin
import AdminDashboard from './pages/admin/Dashboard.jsx'
import AgencyStatus from './pages/admin/AgencyStatus.jsx'
import AdminAgencies from './pages/admin/AdminAgencies.jsx'   
import AgencyDetail from './pages/admin/AgencyDetail.jsx'     
import History from './pages/admin/History.jsx'
import SubmissionDetail from './pages/admin/SubmissionDetail.jsx'

// Super Admin
import SuperDashboard from './pages/superadmin/Dashboard.jsx'
import ManageUsers from './pages/superadmin/ManageUsers.jsx'
import ManageAgencies from './pages/superadmin/ManageAgencies.jsx'
import ManageProducts from './pages/superadmin/ManageProducts.jsx'
import WhatsappOrders from './pages/superadmin/WhatsappOrders.jsx'

// Platform owner (separate login, not a shop user)
import PlatformLogin from './pages/platform/PlatformLogin.jsx'
import PlatformDashboard from './pages/platform/PlatformDashboard.jsx'

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!user) return <Navigate to={signInPath()} replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!user) return <Navigate to={signInPath()} replace />
  if (user.role === 'super_admin') return <Navigate to="/super/dashboard" replace />
  if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />
  return <Navigate to="/staff/agencies" replace />
}

// Thin strip shown only inside the public demo shop (db/005)
function DemoBanner() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  if (user?.shopCode !== 'demo' || pathname === '/demo') return null
  const switchRole = async () => { await logout(); navigate('/demo') }
  return (
    <div className="bg-amber-50 border-b border-amber-100 text-amber-800 text-xs">
      <div className="max-w-lg mx-auto px-4 py-2 flex items-center gap-2">
        <span className="font-medium">Demo shop</span>
        <span className="text-amber-700/80 truncate">Shared sandbox · resets nightly</span>
        <button onClick={switchRole} className="ml-auto shrink-0 font-medium underline underline-offset-2">Switch role</button>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <>
    <DemoBanner />
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/demo" element={<Demo />} />
      <Route path="/" element={<HomeRedirect />} />

      {/* Staff */}
<Route path="/staff/agencies" element={<ProtectedRoute roles={['staff']}><AgencyList /></ProtectedRoute>} />
<Route path="/staff/dashboard" element={<Navigate to="/staff/agencies" replace />} />
<Route path="/staff/agencies/:agencyId" element={<ProtectedRoute roles={['staff']}><StockEntry /></ProtectedRoute>} />
<Route path="/staff/history" element={<ProtectedRoute roles={['staff']}><SubmissionHistory /></ProtectedRoute>} />
<Route path="/staff/history/:submissionId" element={<ProtectedRoute roles={['staff']}><StaffSubmissionDetail /></ProtectedRoute>} /> 
      {/* Admin */}
      <Route path="/admin/dashboard" element={<ProtectedRoute roles={['admin','super_admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/status"    element={<ProtectedRoute roles={['admin','super_admin']}><AgencyStatus /></ProtectedRoute>} />
      <Route path="/admin/agencies"  element={<ProtectedRoute roles={['admin','super_admin']}><AdminAgencies /></ProtectedRoute>} />
      <Route path="/admin/agencies/:agencyId" element={<ProtectedRoute roles={['admin','super_admin']}><AgencyDetail /></ProtectedRoute>} />
      <Route path="/admin/history"   element={<ProtectedRoute roles={['admin','super_admin']}><History /></ProtectedRoute>} />
      <Route path="/admin/history/:submissionId" element={<ProtectedRoute roles={['admin','super_admin']}><SubmissionDetail /></ProtectedRoute>} />

      {/* Super Admin */}
      <Route path="/super/dashboard" element={<ProtectedRoute roles={['super_admin']}><SuperDashboard /></ProtectedRoute>} />
      <Route path="/super/users"     element={<ProtectedRoute roles={['super_admin']}><ManageUsers /></ProtectedRoute>} />
      <Route path="/super/agencies"  element={<ProtectedRoute roles={['super_admin']}><ManageAgencies /></ProtectedRoute>} />
      <Route path="/super/products"  element={<ProtectedRoute roles={['super_admin']}><ManageProducts /></ProtectedRoute>} />
      <Route path="/super/orders"    element={<ProtectedRoute roles={['super_admin']}><WhatsappOrders /></ProtectedRoute>} />

      {/* Platform owner */}
      <Route path="/platform/login" element={<PlatformLogin />} />
      <Route path="/platform" element={<PlatformDashboard />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  )
}