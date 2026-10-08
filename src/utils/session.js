const TOKEN_KEY = 'stock_portal_token'
const USER_KEY = 'stock_portal_user'
const LAST_SHOP_KEY = 'stock_portal_last_shop'
const PLATFORM_TOKEN_KEY = 'stock_portal_platform_token'

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
  if (user.shopName) saveLastShop(user)
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

// Branding of the shop that last used this device, shown on the login screen.
export function getLastShop() {
  return readJson(LAST_SHOP_KEY)
}

export function saveLastShop({ shopName, supportContact }) {
  localStorage.setItem(LAST_SHOP_KEY, JSON.stringify({ shopName, supportContact }))
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
