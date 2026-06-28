'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export async function listActiveProducts() {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('products')
    .select('id, name, category, price_dt, stock_quantity')
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}
