import { supabase } from '../lib/supabase'
import { getToken } from '../utils/session'

function unwrap({ data, error }) {
  if (error) throw new Error(error.message)
  return data
}

export const submitStock = async (agencyId, items) =>
  unwrap(await supabase.rpc('submit_stock', {
    p_token: getToken(),
    p_agency_id: agencyId,
    p_items: items
  }))

export const getAgencyStatus = async () =>
  unwrap(await supabase.rpc('get_agency_status', { p_token: getToken() }))

export const getSubmissionHistory = async (agencyId) =>
  unwrap(await supabase.rpc('get_submission_history', {
    p_token: getToken(),
    p_agency_id: agencyId
  }))

export const getRecentSubmissions = async (limit = 10) =>
  unwrap(await supabase.rpc('get_recent_submissions', {
    p_token: getToken(),
    p_limit: limit
  }))

export const getSubmissionDetail = async (submissionId) =>
  unwrap(await supabase.rpc('get_submission_detail', {
    p_token: getToken(),
    p_submission_id: submissionId
  }))

export const getSuperAdminCounts = async () =>
  unwrap(await supabase.rpc('get_super_admin_counts', { p_token: getToken() }))

export const getAdminCounts = async () =>
  unwrap(await supabase.rpc('get_admin_counts', { p_token: getToken() }))

export const getTodaySubmission = async (agencyId) =>
  unwrap(await supabase.rpc('get_today_submission', {
    p_token: getToken(),
    p_agency_id: agencyId
  }))

export const getAgencyProductsWithQty = async (agencyId) =>
  unwrap(await supabase.rpc('get_agency_products_with_qty', {
    p_token: getToken(),
    p_agency_id: agencyId
  }))

// 👇 ADD THIS NEW FUNCTION 👇
export const getStaffSubmissionHistory = async () =>
  unwrap(await supabase.rpc('get_staff_submission_history', { 
    p_token: getToken() 
  }))

  export const getStaffSubmissionDetail = async (submissionId) =>
  unwrap(await supabase.rpc('get_staff_submission_detail', {
    p_token: getToken(),
    p_submission_id: submissionId
  }))