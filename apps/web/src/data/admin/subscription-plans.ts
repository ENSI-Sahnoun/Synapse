'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export async function listSubscriptionPlans() {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .order('price_dt', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getSubscriptionPlanById(id: string) {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}
