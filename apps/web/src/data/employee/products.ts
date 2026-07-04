'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export interface Product {
  id: string
  name: string
  category: string
  price_dt: number
  stock_quantity: number
  image_url: string | null
  sort_order: number
}

export async function listActiveProducts(): Promise<Product[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('products')
    .select('id, name, category, price_dt, stock_quantity, image_url, sort_order')
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw new Error('Erreur de chargement des produits')
  return data ?? []
}
