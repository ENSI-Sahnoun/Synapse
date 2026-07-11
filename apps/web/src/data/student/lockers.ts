import { createSupabaseClient } from '@/supabase-clients/server'
import { getCachedLoggedInUserIdOrNull } from '@/rsc-data/supabase'
import { format } from 'date-fns'
import { computeLockerStatus } from '@/lib/locker-status'

export async function getMyLocker(): Promise<{ number: number } | null> {
  const supabase = await createSupabaseClient()
  const userId = await getCachedLoggedInUserIdOrNull()
  if (!userId) return null

  const today = format(new Date(), 'yyyy-MM-dd')

  const { data } = await supabase
    .from('lockers')
    .select('number, is_unavailable, assigned_student_id, subscriptions:assigned_subscription_id(end_date)')
    .eq('assigned_student_id', userId)
    .maybeSingle()

  if (!data) return null

  const subscriptionEndDate = (data.subscriptions as { end_date: string } | null)?.end_date ?? null
  const status = computeLockerStatus(
    { isUnavailable: data.is_unavailable, assignedStudentId: data.assigned_student_id, subscriptionEndDate },
    today,
  )

  return status === 'occupied' ? { number: data.number } : null
}
