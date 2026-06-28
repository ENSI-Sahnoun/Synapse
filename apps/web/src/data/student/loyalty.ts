'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

/** Returns current loyalty point balance for the authenticated student. */
export async function getStudentLoyaltyBalance(studentId: string): Promise<number> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('loyalty_ledger')
    .select('points_delta')
    .eq('student_id', studentId)
  if (error) throw error
  return (data ?? []).reduce((sum, row) => sum + row.points_delta, 0)
}

/** Returns full ledger history for the student, newest first. */
export async function getStudentLoyaltyLedger(studentId: string) {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('loyalty_ledger')
    .select('id, points_delta, reason, created_at')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** Returns all active loyalty rules. */
export async function getActiveLoyaltyRules() {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('loyalty_rules')
    .select('id, name, reward_type, points_threshold, reward_value')
    .eq('is_active', true)
    .order('points_threshold', { ascending: true })
  if (error) throw error
  return data ?? []
}

/** Returns pending redemption request IDs for the student (to prevent duplicates). */
export async function getStudentPendingRequestRuleIds(studentId: string): Promise<string[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('loyalty_redemption_requests')
    .select('rule_id')
    .eq('student_id', studentId)
    .eq('status', 'pending')
  if (error) throw error
  return (data ?? []).map((r) => r.rule_id)
}

/** Returns all redemption requests for the student, newest first. */
export async function getStudentRedemptionRequests(studentId: string) {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('loyalty_redemption_requests')
    .select('id, status, points_used, created_at, handled_at, loyalty_rules(name)')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}
