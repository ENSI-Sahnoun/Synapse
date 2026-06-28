'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export async function listLoyaltyRules() {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('loyalty_rules')
    .select('*')
    .order('points_threshold', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getLoyaltyRuleById(id: string) {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('loyalty_rules')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}
