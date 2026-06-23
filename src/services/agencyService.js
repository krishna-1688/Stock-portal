import { supabase } from '../lib/supabase'
import { getToken } from '../utils/session'

function unwrap({ data, error }) {
  if (error) throw new Error(error.message)
  return data
}

export const getActiveAgencies = async () =>
  unwrap(await supabase.rpc('get_active_agencies', { p_token: getToken() }))

export const getAllAgenciesAdmin = async () =>
  unwrap(await supabase.rpc('get_all_agencies_admin', { p_token: getToken() }))

export const createAgency = async (name, whatsapp = null) =>
  unwrap(await supabase.rpc('create_agency', {
    p_token: getToken(),
    p_name: name,
    p_whatsapp: whatsapp,
  }))

export const updateAgency = async (agencyId, name, isActive, whatsapp = null) =>
  unwrap(await supabase.rpc('update_agency', {
    p_token: getToken(),
    p_agency_id: agencyId,
    p_name: name,
    p_is_active: isActive,
    p_whatsapp: whatsapp,
  }))

export const deleteAgency = async (agencyId) =>
  unwrap(await supabase.rpc('delete_agency', {
    p_token: getToken(),
    p_agency_id: agencyId,
  }))