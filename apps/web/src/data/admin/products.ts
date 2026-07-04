'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export interface AdminProduct {
  id: string
  name: string
  category: string
  price_dt: number
  cost_price: number | null
  supplier: string | null
  barcode: string | null
  stock_quantity: number
  is_active: boolean
  image_url: string | null
  created_at: string
  sort_order: number
}

export async function listAllProducts(): Promise<AdminProduct[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('products')
    .select('id, name, category, price_dt, cost_price, supplier, barcode, stock_quantity, is_active, image_url, created_at, sort_order')
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw new Error('Erreur de chargement des produits')
  return data ?? []
}

export async function getProductById(id: string): Promise<AdminProduct | null> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('products')
    .select('id, name, category, price_dt, cost_price, supplier, barcode, stock_quantity, is_active, image_url, created_at, sort_order')
    .eq('id', id)
    .single()
  if (error) return null
  return data
}
