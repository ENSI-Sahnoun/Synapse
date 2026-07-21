'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export async function listAchievements() {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('achievements')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function listLevels() {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('levels')
    .select('*')
    .order('level', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function listManualAchievements() {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('achievements')
    .select('id, title, emoji')
    .eq('category', 'manual')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data ?? []
}
