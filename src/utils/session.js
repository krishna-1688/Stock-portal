const TOKEN_KEY = 'stock_portal_token'
const USER_KEY = 'stock_portal_user'
const PLATFORM_TOKEN_KEY = 'stock_portal_platform_token'

// Older versions remembered the last shop's name for the login screen; the login
// screen is now neutral, so drop that leftover from devices that still have it.
try { localStorage.removeItem('stock_portal_last_shop') } catch { /* storage unavailable */ }

function readJson(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser() {
  return readJson(USER_KEY)
}

export function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

// Platform owner session — kept apart from shop sessions.
export function getPlatformToken() {
  return localStorage.getItem(PLATFORM_TOKEN_KEY)
}

export function savePlatformToken(token) {
  localStorage.setItem(PLATFORM_TOKEN_KEY, token)
}

export function clearPlatformToken() {
  localStorage.removeItem(PLATFORM_TOKEN_KEY)
}
