'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export interface Product {
  id: string
  name: string
  category: string
  price_dt: number
  stock_quantity: number
}

export async function listActiveProducts(): Promise<Product[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('products' as never)
    .select('id, name, category, price_dt, stock_quantity')
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as Product[]
}
