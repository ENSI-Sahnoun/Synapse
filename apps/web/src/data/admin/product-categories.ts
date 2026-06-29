'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export interface ProductCategory {
  id: string
  name: string
}

export async function listProductCategories(): Promise<ProductCategory[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('product_categories')
    .select('id, name')
    .order('name')
  if (error) throw new Error('Erreur de chargement des catégories')
  return data ?? []
}
