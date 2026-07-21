'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export type Achievement = {
  id: string
  category: 'visits' | 'hours' | 'spend' | 'purchase_count' | 'streak' | 'manual'
  threshold: number | null
  points: number
  title: string
  description: string | null
  emoji: string
  sort_order: number
  unlocked: boolean
  unlocked_at: string | null
  progress: number
}

export async function getMyAchievements(): Promise<Achievement[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.rpc('get_my_achievements')
  if (error) throw error
  return (data ?? []) as Achievement[]
}

export type StudentLevel = { student_id: string; level: number; xp: number }

export async function getLevelsForStudents(studentIds: string[]): Promise<StudentLevel[]> {
  if (studentIds.length === 0) return []
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.rpc('get_levels_for_students', { p_student_ids: studentIds })
  if (error) throw error
  return data ?? []
}

export type AchievementUnlockers = Record<string, { totalCount: number; sampleNames: string[] }>

export async function getAchievementUnlockers(achievementIds: string[]): Promise<AchievementUnlockers> {
  if (achievementIds.length === 0) return {}
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.rpc('get_achievement_unlockers', { p_achievement_ids: achievementIds })
  if (error) throw error
  const out: AchievementUnlockers = {}
  for (const row of data ?? []) {
    out[row.achievement_id] = { totalCount: row.total_count, sampleNames: row.sample_names ?? [] }
  }
  return out
}
