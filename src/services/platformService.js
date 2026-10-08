import { supabase } from '../lib/supabase'
import { getPlatformToken } from '../utils/session'
import { isMissingFunction } from './authService'

function unwrap({ data, error }) {
  if (error) throw new Error(error.message)
  return data
}

// platform_login_v2 (migration 003) has brute-force lockout; legacy fallback until then.
export const platformLogin = async (username, password) => {
  const v2 = await supabase.rpc('platform_login_v2', { p_username: username, p_password: password })
  if (!v2.error) {
    if (!v2.data?.ok) throw new Error(v2.data?.error ?? 'Incorrect username or password')
    return v2.data
  }
  if (!isMissingFunction(v2.error)) throw new Error(v2.error.message)
  return unwrap(await supabase.rpc('platform_login', { p_username: username, p_password: password }))?.[0]
}

export const platformValidateSession = async () =>
  unwrap(await supabase.rpc('platform_validate_session', { p_token: getPlatformToken() }))?.[0]

export const platformLogout = async () =>
  unwrap(await supabase.rpc('platform_logout', { p_token: getPlatformToken() }))

export const listShops = async () =>
  unwrap(await supabase.rpc('platform_list_shops', { p_token: getPlatformToken() }))

export const createShop = async ({ name, code, timezone, supportContact, adminName, adminUsername, adminPassword }) =>
  unwrap(await supabase.rpc('platform_create_shop', {
    p_token: getPlatformToken(),
    p_name: name,
    p_code: code,
    p_timezone: timezone,
    p_support_contact: supportContact,
    p_admin_name: adminName,
    p_admin_username: adminUsername,
    p_admin_password: adminPassword,
  }))

export const updateShop = async (shopId, { name, timezone, supportContact, isActive }) =>
  unwrap(await supabase.rpc('platform_update_shop', {
    p_token: getPlatformToken(),
    p_shop_id: shopId,
    p_name: name,
    p_timezone: timezone,
    p_support_contact: supportContact,
    p_is_active: isActive,
  }))

export const getShopUsers = async (shopId) =>
  unwrap(await supabase.rpc('platform_get_shop_users', { p_token: getPlatformToken(), p_shop_id: shopId }))

export const createShopUser = async (shopId, { name, username, password, role }) =>
  unwrap(await supabase.rpc('platform_create_shop_user', {
    p_token: getPlatformToken(),
    p_shop_id: shopId,
    p_name: name,
    p_username: username,
    p_password: password,
    p_role: role,
  }))

export const resetShopUserPassword = async (userId, newPassword) =>
  unwrap(await supabase.rpc('platform_reset_user_password', {
    p_token: getPlatformToken(),
    p_user_id: userId,
    p_new_password: newPassword,
  }))

export const setShopUserActive = async (userId, isActive) =>
  unwrap(await supabase.rpc('platform_set_user_active', {
    p_token: getPlatformToken(),
    p_user_id: userId,
    p_is_active: isActive,
  }))
