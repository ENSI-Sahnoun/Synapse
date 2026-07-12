'use server'

import { createSupabaseAdminClient } from '@/supabase-clients/admin'

export async function getLockerReminderDelayDays(): Promise<number> {
  const supabase = createSupabaseAdminClient()
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'locker_reminder_delay_days')
    .maybeSingle()
  const parsed = parseInt(data?.value ?? '1', 10)
  return Number.isNaN(parsed) ? 1 : parsed
}

export interface ExpiredLockerRow {
  student_id: string
  locker_number: number
}

/**
 * Lockers still assigned to a student whose linked subscription expired
 * exactly `delayDays` days ago. Exact-date match means the daily cron
 * produces the reminder once per locker (same dedup mechanism as the
 * subscription expiry triggers). Students holding another still-active
 * subscription (renewal without staff reassigning the locker) are excluded —
 * they should not be told to free their locker.
 */
export async function getExpiredLockersForReminder(delayDays: number): Promise<ExpiredLockerRow[]> {
  const supabase = createSupabaseAdminClient()

  const targetDate = new Date()
  targetDate.setDate(targetDate.getDate() - delayDays)
  const targetDateStr = targetDate.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('lockers')
    .select('number, assigned_student_id, subscriptions:assigned_subscription_id!inner(end_date)')
    .not('assigned_student_id', 'is', null)
    .eq('subscriptions.end_date', targetDateStr)

  if (error) throw error
  const candidates = (data ?? []).map((row: any) => ({
    student_id: row.assigned_student_id as string,
    locker_number: row.number as number,
  }))
  if (candidates.length === 0) return []

  const todayStr = new Date().toISOString().split('T')[0]
  const { data: activeSubs, error: activeError } = await supabase
    .from('subscriptions')
    .select('student_id')
    .in('student_id', candidates.map((c) => c.student_id))
    .gte('end_date', todayStr)

  if (activeError) throw activeError
  const renewed = new Set((activeSubs ?? []).map((s) => s.student_id))
  return candidates.filter((c) => !renewed.has(c.student_id))
}
