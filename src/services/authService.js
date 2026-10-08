import { supabase } from '../lib/supabase'

// PostgREST error code when an RPC doesn't exist (e.g. before migration 003).
export const isMissingFunction = (error) => error?.code === 'PGRST202'

// login_v2 (migration 003) counts failed attempts and locks the username after
// too many; it returns { ok, error } instead of raising. Falls back to the
// legacy login() until 003 is applied.
export async function loginRequest(username, password) {
  const v2 = await supabase.rpc('login_v2', { p_username: username, p_password: password })
  if (!v2.error) {
    if (!v2.data?.ok) throw new Error(v2.data?.error ?? 'Incorrect username or password')
    return v2.data
  }
  if (!isMissingFunction(v2.error)) throw new Error(v2.error.message)

  const { data, error } = await supabase.rpc('login', {
    p_username: username,
    p_password: password
  })
  if (error) throw new Error(error.message)
  return data?.[0]
}

export async function logoutRequest(token) {
  if (!token) return
  await supabase.rpc('logout', { p_token: token })
}

export async function validateSessionRequest(token) {
  const { data, error } = await supabase.rpc('validate_session', {
    p_token: token
  })
  if (error) throw new Error(error.message)
  return data?.[0]
}