'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export async function listPendingRedemptionRequests() {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('loyalty_redemption_requests')
    .select(`
      id,
      status,
      points_used,
      created_at,
      student:profiles!student_id(id, full_name, phone, avatar_url),
      rule:loyalty_rules!rule_id(id, name, reward_type, reward_value)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function listRecentFulfilledRequests(limit = 20) {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('loyalty_redemption_requests')
    .select(`
      id,
      status,
      points_used,
      created_at,
      handled_at,
      student:profiles!student_id(id, full_name, avatar_url),
      rule:loyalty_rules!rule_id(id, name, reward_type)
    `)
    .in('status', ['fulfilled', 'rejected'])
    .order('handled_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}
