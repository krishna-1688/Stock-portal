import { supabase } from '../lib/supabase'
import { getToken } from '../utils/session'
import { isMissingFunction } from './authService'

function unwrap({ data, error }) {
  if (error) throw new Error(error.message)
  return data
}

// Records a WhatsApp order (migration 003). Resolves to false — without
// throwing — when the history table isn't installed yet.
export const logWhatsappOrder = async (agencyId, items, message) => {
  const { error } = await supabase.rpc('log_whatsapp_order', {
    p_token: getToken(),
    p_agency_id: agencyId,
    p_items: items,
    p_message: message,
  })
  if (error && isMissingFunction(error)) return false
  if (error) throw new Error(error.message)
  return true
}

export const getWhatsappOrders = async ({ agencyId = null, before = null, limit = 50 } = {}) =>
  unwrap(await supabase.rpc('get_whatsapp_orders', {
    p_token: getToken(),
    p_agency_id: agencyId,
    p_before: before,
    p_limit: limit,
  }))
