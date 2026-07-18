import { supabase } from '../lib/supabase'
import { getToken } from '../utils/session'

function unwrap({ data, error }) {
  if (error) throw new Error(error.message)
  return data
}

export const getUsers = async () =>
  unwrap(await supabase.rpc('get_users', { p_token: getToken() }))

export const createUser = async (name, username, password, role) =>
  unwrap(await supabase.rpc('create_user', {
    p_token: getToken(),
    p_name: name,
    p_username: username,
    p_password: password,
    p_role: role
  }))

export const updateUser = async (userId, name, username, role) =>
  unwrap(await supabase.rpc('update_user', {
    p_token: getToken(),
    p_user_id: userId,
    p_name: name,
    p_username: username,
    p_role: role
  }))

export const resetPassword = async (userId, newPassword) =>
  unwrap(await supabase.rpc('reset_password', {
    p_token: getToken(),
    p_user_id: userId,
    p_new_password: newPassword
  }))

// SOFT DELETE — deactivates user, kills their sessions
export const deactivateUser = async (userId) =>
  unwrap(await supabase.rpc('deactivate_user', {
    p_token: getToken(),
    p_user_id: userId
  }))

// REACTIVATE — brings a deactivated user back
export const reactivateUser = async (userId) =>
  unwrap(await supabase.rpc('reactivate_user', {
    p_token: getToken(),
    p_user_id: userId
  }))

// Keep old deleteUser for users with zero submissions (optional)
export const deleteUser = async (userId) =>
  unwrap(await supabase.rpc('delete_user', {
    p_token: getToken(),
    p_user_id: userId
  }))