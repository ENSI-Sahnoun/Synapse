'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export type LeaderboardCategory = 'visits' | 'hours' | 'spend'

export type LeaderboardRow = {
  category: LeaderboardCategory
  label: string
  emoji: string
  rank: number
  student_id: string
  full_name: string | null
  value: number
}

export type LeaderboardConfigRow = {
  category: LeaderboardCategory
  enabled: boolean
  label: string
  emoji: string
  points_1: number
  points_2: number
  points_3: number
  sort_order: number
}

export type LeaderboardSettings = {
  enabled: boolean
  prizeSecret: boolean
  listSize: number
}

export type MyRank = { category: LeaderboardCategory; rank: number | null; value: number }

/** First day of the current calendar month, as an ISO date (YYYY-MM-DD). */
function currentMonthISO(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
}

export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.rpc('get_leaderboard', { p_month: currentMonthISO() })
  if (error) throw error
  return (data ?? []) as LeaderboardRow[]
}

export async function getMyLeaderboardRank(): Promise<MyRank[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.rpc('get_my_leaderboard_rank', { p_month: currentMonthISO() })
  if (error) throw error
  return (data ?? []) as MyRank[]
}

export async function getLeaderboardSettings(): Promise<LeaderboardSettings> {
  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['leaderboard_enabled', 'leaderboard_prize_secret', 'leaderboard_list_size'])
  const map = new Map((data ?? []).map((r) => [r.key, r.value]))
  return {
    enabled: (map.get('leaderboard_enabled') ?? 'true') === 'true',
    prizeSecret: (map.get('leaderboard_prize_secret') ?? 'false') === 'true',
    listSize: parseInt(map.get('leaderboard_list_size') ?? '10', 10),
  }
}

export async function getLeaderboardConfig(): Promise<LeaderboardConfigRow[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('leaderboard_config')
    .select('category, enabled, label, emoji, points_1, points_2, points_3, sort_order')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as LeaderboardConfigRow[]
}
