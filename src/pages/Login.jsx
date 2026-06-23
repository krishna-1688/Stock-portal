import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Button from '../components/ui/Button'
import Alert from '../components/ui/Alert'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password')
      return
    }
    setLoading(true)
    try {
      const user = await login(username.trim(), password)
      if (user.role === 'super_admin') navigate('/super/dashboard')
      else if (user.role === 'admin') navigate('/admin/dashboard')
      else navigate('/staff/agencies')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="w-16 h-16 bg-brand-600 rounded-2xl flex items-center justify-center shadow-lg">
          <span className="text-white text-3xl font-bold">S</span>
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800">Stock Portal</h1>
          <p className="text-gray-500 text-sm mt-1">Sampath Super Market</p>
        </div>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-6">Sign in to continue</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              autoCapitalize="none"
              autoCorrect="off"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-800 placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-800 placeholder-gray-400"
            />
          </div>

          <Alert type="error" message={error} />

          <Button
            type="submit"
            loading={loading}
            fullWidth
            size="lg"
          >
            Login
          </Button>
        </form>
      </div>

      <p className="text-xs text-gray-400 mt-6">
        Contact  kk if you forgot your password
      </p>
    </div>
  )
}