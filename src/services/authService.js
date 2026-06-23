import { supabase } from '../lib/supabase'

export async function loginRequest(username, password) {
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