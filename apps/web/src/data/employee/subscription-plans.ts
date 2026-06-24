'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export async function listActivePlans() {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('id, name, duration_days, price_dt')
    .eq('is_active', true)
    .order('price_dt', { ascending: true })
  if (error) throw error
  return data ?? []
}
