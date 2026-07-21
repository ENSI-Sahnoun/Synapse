'use server'

import { createSupabaseClient } from '@/supabase-clients/server'
import { notFound } from 'next/navigation'

export async function getProfileById(id: string) {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, full_name, avatar_url, university, study_level')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) notFound()
  return data
}

export async function getAchievementsForStudent(id: string) {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.rpc('get_achievements_for_student', { p_student_id: id })
  if (error) throw error
  return (data ?? []) as import('@/data/student/achievements').Achievement[]
}

export async function getLoyaltyBalanceForStudent(id: string) {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.rpc('get_loyalty_balance_for_student', { p_student_id: id })
  if (error) throw error
  return data ?? 0
}

