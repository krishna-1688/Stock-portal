import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

import Login from './pages/Login.jsx'

// Staff
import StaffSubmissionDetail from './pages/staff/StaffSubmissionDetail.jsx'
import StaffDashboard from './pages/staff/Dashboard.jsx'
import AgencyList from './pages/staff/AgencyList.jsx'
import StockEntry from './pages/staff/StockEntry.jsx'
import SubmissionHistory from './pages/staff/SubmissionHistory.jsx' // ← NEW import

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

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
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
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'super_admin') return <Navigate to="/super/dashboard" replace />
  if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />
  return <Navigate to="/staff/agencies" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<HomeRedirect />} />

      {/* Staff */}
<Route path="/staff/agencies" element={<ProtectedRoute roles={['staff']}><AgencyList /></ProtectedRoute>} />
<Route path="/staff/dashboard" element={<ProtectedRoute roles={['staff']}><StaffDashboard /></ProtectedRoute>} />
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

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}