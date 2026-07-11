'use server'

import { createSupabaseClient } from '@/supabase-clients/server'
import { format } from 'date-fns'
import { computeLockerStatus, type LockerStatus } from '@/lib/locker-status'

export interface LockerRow {
  id: string
  number: number
  status: LockerStatus
  student: { id: string; full_name: string | null; student_number: number | null } | null
  subscriptionEndDate: string | null
}

export async function getLockersWithStatus(): Promise<LockerRow[]> {
  const supabase = await createSupabaseClient()
  const today = format(new Date(), 'yyyy-MM-dd')

  const { data, error } = await supabase
    .from('lockers')
    .select(`
      id, number, is_unavailable, assigned_student_id,
      profiles:assigned_student_id ( id, full_name, student_number ),
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
        ? (row.profiles as { id: string; full_name: string | null; student_number: number | null } | null)
        : null
    return { id: row.id, number: row.number, status, student, subscriptionEndDate }
  })
}

export async function getEligibleStudentsForLocker() {
  const supabase = await createSupabaseClient()
  const today = format(new Date(), 'yyyy-MM-dd')

  const { data: subs, error: subsError } = await supabase
    .from('subscriptions')
    .select('student_id, subscription_plans!inner(duration_days)')
    .gte('end_date', today)
    .gte('subscription_plans.duration_days', 30)

  if (subsError) throw subsError
  const eligibleIds = [...new Set((subs ?? []).map((s) => s.student_id))]
  if (eligibleIds.length === 0) return []

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, student_number, phone')
    .in('id', eligibleIds)
    .eq('role', 'student')
    .eq('is_archived', false)
    .order('full_name', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function getActiveEligibleSubscriptionId(studentId: string): Promise<string | null> {
  const supabase = await createSupabaseClient()
  const today = format(new Date(), 'yyyy-MM-dd')

  const { data, error } = await supabase
    .from('subscriptions')
    .select('id, subscription_plans!inner(duration_days)')
    .eq('student_id', studentId)
    .gte('end_date', today)
    .gte('subscription_plans.duration_days', 30)
    .order('end_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data?.id ?? null
}
