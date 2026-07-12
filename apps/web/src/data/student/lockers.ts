import { createSupabaseClient } from '@/supabase-clients/server'
import { getCachedLoggedInUserIdOrNull } from '@/rsc-data/supabase'
import { format } from 'date-fns'
import { computeLockerBadgeState, type LockerBadgeState } from '@/lib/locker-status'

export interface MyLocker {
  number: number
  endDate: string
  badge: LockerBadgeState
}

export async function getMyLocker(): Promise<MyLocker | null> {
  const supabase = await createSupabaseClient()
  const userId = await getCachedLoggedInUserIdOrNull()
  if (!userId) return null

  const { data } = await supabase
    .from('lockers')
    .select('number, is_unavailable, subscriptions:assigned_subscription_id(end_date)')
    .eq('assigned_student_id', userId)
    .maybeSingle()

  if (!data || data.is_unavailable) return null
  const endDate = (data.subscriptions as { end_date: string } | null)?.end_date ?? null
  if (!endDate) return null

  const today = format(new Date(), 'yyyy-MM-dd')
  return { number: data.number, endDate, badge: computeLockerBadgeState(endDate, today) }
}
