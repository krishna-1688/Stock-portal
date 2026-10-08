// Local drafts (stock counts, WhatsApp orders) are kept per user so that two
// people sharing a phone — or two shops — never see each other's drafts.
//
// Drafts saved before multi-tenancy used keys without the user id
// (e.g. `stock_draft_<agencyId>`). The first time a user opens that agency
// the old draft is moved to their key, so nothing in progress is lost.

import { getStoredUser } from './session'

function keyFor(kind, agencyId) {
  const userId = getStoredUser()?.id ?? 'anon'
  return `${kind}_${userId}_${agencyId}`
}

export function loadDraft(kind, agencyId) {
  const key = keyFor(kind, agencyId)
  const legacyKey = `${kind}_${agencyId}`
  try {
    let raw = localStorage.getItem(key)
    if (raw == null) {
      const legacy = localStorage.getItem(legacyKey)
      if (legacy != null) {
        localStorage.setItem(key, legacy)
        localStorage.removeItem(legacyKey)
        raw = legacy
      }
    }
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveDraft(kind, agencyId, value) {
  localStorage.setItem(keyFor(kind, agencyId), JSON.stringify(value))
}

export function clearDraft(kind, agencyId) {
  localStorage.removeItem(keyFor(kind, agencyId))
}
