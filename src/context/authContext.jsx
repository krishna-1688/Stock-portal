import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { loginRequest, logoutRequest, validateSessionRequest } from '../services/authService'
import { getToken, getStoredUser, saveSession, clearSession } from '../utils/session'

const AuthContext = createContext(null)

// Shape the RPC row (login / validate_session) into the app's user object.
function toUser(row) {
  return {
    id: row.user_id,
    name: row.name,
    username: row.username,
    role: row.role,
    shopId: row.shop_id,
    shopName: row.shop_name,
    shopCode: row.shop_code,
    supportContact: row.support_contact,
  }
}

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
          const freshUser = toUser(fresh)
          saveSession(storedToken, freshUser)
          setUser(freshUser)
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
    if (!result) throw new Error('Incorrect username or password')
    const loggedInUser = toUser(result)
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
