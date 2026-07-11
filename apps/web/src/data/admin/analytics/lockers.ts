import { createSupabaseClient } from '@/supabase-clients/server'
import { getLockersWithStatus } from '@/data/employee/lockers'

export type LockerStats = {
  occupied: number
  available: number
  unavailable: number
  total: number
  assignmentsInRange: number
  revenueInRange: number
}

export async function getLockerStats(range: { from: string; to: string }): Promise<LockerStats> {
  const supabase = await createSupabaseClient()

  const [lockers, { data: payments }] = await Promise.all([
    getLockersWithStatus(),
    supabase
      .from('locker_payments')
      .select('amount_dt')
      .gte('created_at', range.from + 'T00:00:00')
      .lte('created_at', range.to + 'T23:59:59'),
  ])

  return {
    occupied: lockers.filter((l) => l.status === 'occupied').length,
    available: lockers.filter((l) => l.status === 'available').length,
    unavailable: lockers.filter((l) => l.status === 'unavailable').length,
    total: lockers.length,
    assignmentsInRange: payments?.length ?? 0,
    revenueInRange: payments?.reduce((s, r) => s + Number(r.amount_dt), 0) ?? 0,
  }
}
