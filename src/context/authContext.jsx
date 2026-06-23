import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { loginRequest, logoutRequest, validateSessionRequest } from '../services/authService'
import { getToken, getStoredUser, saveSession, clearSession } from '../utils/session'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedToken = getToken()
    const storedUser = getStoredUser()

    if (!storedToken || !storedUser) {
      setLoading(false)
      return
    }

    setUser(storedUser)
    setToken(storedToken)

    validateSessionRequest(storedToken)
      .then((fresh) => {
        if (fresh) {
          setUser({ id: fresh.user_id, name: fresh.name, username: fresh.username, role: fresh.role })
        } else {
          clearSession()
          setUser(null)
          setToken(null)
        }
      })
      .catch(() => {
        clearSession()
        setUser(null)
        setToken(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (username, password) => {
    const result = await loginRequest(username, password)
    const loggedInUser = {
      id: result.user_id,
      name: result.name,
      username: result.username,
      role: result.role
    }
    saveSession(result.token, loggedInUser)
    setToken(result.token)
    setUser(loggedInUser)
    return loggedInUser
  }, [])

  const logout = useCallback(async () => {
    await logoutRequest(token).catch(() => {})
    clearSession()
    setToken(null)
    setUser(null)
  }, [token])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}