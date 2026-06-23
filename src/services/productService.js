import { supabase } from '../lib/supabase'
import { getToken } from '../utils/session'

function unwrap({ data, error }) {
  if (error) throw new Error(error.message)
  return data
}

export const getProductsByAgency = async (agencyId) =>
  unwrap(await supabase.rpc('get_products_by_agency', {
    p_token: getToken(),
    p_agency_id: agencyId
  }))

export const getAllProductsAdmin = async () =>
  unwrap(await supabase.rpc('get_all_products_admin', { p_token: getToken() }))

export const createProduct = async (agencyId, name) =>
  unwrap(await supabase.rpc('create_product', {
    p_token: getToken(),
    p_agency_id: agencyId,
    p_name: name
  }))

export const updateProduct = async (productId, name, agencyId, isActive) =>
  unwrap(await supabase.rpc('update_product', {
    p_token: getToken(),
    p_product_id: productId,
    p_name: name,
    p_agency_id: agencyId,
    p_is_active: isActive
  }))

export const deleteProduct = async (productId) =>
  unwrap(await supabase.rpc('delete_product', {
    p_token: getToken(),
    p_product_id: productId
  }))