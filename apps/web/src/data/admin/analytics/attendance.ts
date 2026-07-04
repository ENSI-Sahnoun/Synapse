import { createSupabaseClient } from '@/supabase-clients/server'

export type PeakHoursPoint = { weekday: number; hour: number; visits: number }

export async function getPeakHours(range: { from: string; to: string }): Promise<PeakHoursPoint[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.rpc('analytics_peak_hours', {
    p_from: range.from,
    p_to: range.to,
  })
  if (error) throw new Error(error.message)

  return (data ?? []).map((r) => ({
    weekday: r.weekday,
    hour: r.hour,
    visits: Number(r.visits),
  }))
}

export type Occupancy = { occupied: number; total: number }
export type SessionDuration = { avgMinutes: number; sessionsCounted: number }
export type EntryMethodSplit = { method: string; count: number }

export function averageSessionMinutes(
  sessions: Array<{ checkedInAt: string; checkedOutAt: string }>,
): number {
  if (sessions.length === 0) return 0
  const totalMinutes = sessions.reduce((sum, s) => {
    const minutes = (new Date(s.checkedOutAt).getTime() - new Date(s.checkedInAt).getTime()) / 60_000
    return sum + minutes
  }, 0)
  return totalMinutes / sessions.length
}

export async function getCurrentOccupancy(): Promise<Occupancy> {
  const supabase = await createSupabaseClient()

  const [{ count: total }, { count: occupied }] = await Promise.all([
    supabase.from('seats').select('*', { count: 'exact', head: true }).neq('status', 'out_of_service'),
    supabase.from('seats').select('*', { count: 'exact', head: true }).eq('status', 'occupied'),
  ])

  return { occupied: occupied ?? 0, total: total ?? 0 }
}

export async function getAvgSessionDuration(range: { from: string; to: string }): Promise<SessionDuration> {
  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('attendance')
    .select('checked_in_at, checked_out_at')
    .not('checked_out_at', 'is', null)
    .gte('checked_in_at', range.from + 'T00:00:00')
    .lte('checked_in_at', range.to + 'T23:59:59')

  const sessions = (data ?? []).map((r) => ({
    checkedInAt: r.checked_in_at,
    checkedOutAt: r.checked_out_at as string,
  }))

  return { avgMinutes: averageSessionMinutes(sessions), sessionsCounted: sessions.length }
}

export async function getEntryMethodSplit(range: { from: string; to: string }): Promise<EntryMethodSplit[]> {
  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('attendance')
    .select('entry_method')
    .gte('checked_in_at', range.from + 'T00:00:00')
    .lte('checked_in_at', range.to + 'T23:59:59')

  const map = new Map<string, number>()
  data?.forEach((r) => {
    map.set(r.entry_method, (map.get(r.entry_method) ?? 0) + 1)
  })
  return Array.from(map.entries()).map(([method, count]) => ({ method, count }))
}
