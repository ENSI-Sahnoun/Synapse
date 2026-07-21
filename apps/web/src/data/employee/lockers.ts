'use server'

import { createSupabaseClient } from '@/supabase-clients/server'
import { format } from 'date-fns'
import { computeLockerStatus, type LockerStatus } from '@/lib/locker-status'

export interface LockerRow {
  id: string
  number: number
  status: LockerStatus
  student: { id: string; full_name: string | null; student_number: number | null; avatar_url: string | null } | null
  subscriptionEndDate: string | null
}

export async function getLockersWithStatus(): Promise<LockerRow[]> {
  const supabase = await createSupabaseClient()
  const today = format(new Date(), 'yyyy-MM-dd')

  const { data, error } = await supabase
    .from('lockers')
    .select(`
      id, number, is_unavailable, assigned_student_id,
      profiles:assigned_student_id ( id, full_name, student_number, avatar_url ),
      subscriptions:assigned_subscription_id ( end_date )
    `)
    .order('number', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row) => {
    const subscriptionEndDate = (row.subscriptions as { end_date: string } | null)?.end_date ?? null
    const status = computeLockerStatus(
      {
        isUnavailable: row.is_unavailable,
        assignedStudentId: row.assigned_student_id,
        subscriptionEndDate,
      },
      today,
    )
    const student =
      status === 'occupied'
        ? (row.profiles as { id: string; full_name: string | null; student_number: number | null; avatar_url: string | null } | null)
        : null
    return { id: row.id, number: row.number, status, student, subscriptionEndDate }
  })
}

export interface StudentForLocker {
  id: string
  full_name: string | null
  student_number: number | null
  phone: string | null
  avatar_url: string | null
  is_eligible: boolean
}

export async function getLockerMinDurationDays(): Promise<number> {
  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'locker_min_duration_days')
    .maybeSingle()
  return parseInt(data?.value ?? '30', 10)
}

export async function getLockerFeeDt(): Promise<number> {
  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'locker_fee_dt')
    .maybeSingle()
  return parseFloat(data?.value ?? '0')
}

export async function getLockerReminderDelayDaysForAdmin(): Promise<number> {
  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'locker_reminder_delay_days')
    .maybeSingle()
  return parseInt(data?.value ?? '1', 10)
}

export async function getEligibleStudentsForLocker(): Promise<StudentForLocker[]> {
  const supabase = await createSupabaseClient()
  const today = format(new Date(), 'yyyy-MM-dd')
  const minDurationDays = await getLockerMinDurationDays()

  const [{ data: subs, error: subsError }, { data: students, error: studentsError }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('student_id, subscription_plans!inner(duration_days)')
      .gte('end_date', today)
      .gte('subscription_plans.duration_days', minDurationDays),
    supabase
      .from('profiles')
      .select('id, full_name, student_number, phone, avatar_url')
      .eq('role', 'student')
      .eq('is_archived', false)
      .order('full_name', { ascending: true }),
  ])

  if (subsError) throw subsError
  if (studentsError) throw studentsError

  const eligibleIds = new Set((subs ?? []).map((s) => s.student_id))
  return (students ?? []).map((s) => ({ ...s, is_eligible: eligibleIds.has(s.id) }))
}

export async function getActiveEligibleSubscriptionId(studentId: string): Promise<string | null> {
  const supabase = await createSupabaseClient()
  const today = format(new Date(), 'yyyy-MM-dd')
  const minDurationDays = await getLockerMinDurationDays()

  const { data, error } = await supabase
    .from('subscriptions')
    .select('id, subscription_plans!inner(duration_days)')
    .eq('student_id', studentId)
    .gte('end_date', today)
    .gte('subscription_plans.duration_days', minDurationDays)
    .order('end_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data?.id ?? null
}
