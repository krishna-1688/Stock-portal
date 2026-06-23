const TOKEN_KEY = 'stock_portal_token'
const USER_KEY = 'stock_portal_user'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY)
  return raw ? JSON.parse(raw) : null
}

export function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}