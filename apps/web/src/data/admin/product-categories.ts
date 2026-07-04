'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export interface ProductCategory {
  id: string
  name: string
  emoji: string | null
  sort_order: number
}

export async function listProductCategories(): Promise<ProductCategory[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('product_categories')
    .select('id, name, emoji, sort_order')
    .order('sort_order')
    .order('name')
  if (error) throw new Error('Erreur de chargement des catégories')
  return data ?? []
}
