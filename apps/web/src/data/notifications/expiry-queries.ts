'use server'

import { createAdminClient } from '@/supabase-clients/server'

export interface StudentSubscriptionRow {
  subscription_id: string
  student_id: string
  student_name: string
  student_email: string | null
  student_phone: string | null
  plan_name: string
  end_date: string // ISO date string yyyy-MM-dd
  days_remaining: number // can be negative for expired
}

/**
 * Returns students whose subscription end_date is exactly `daysFromToday` days from today.
 * daysFromToday = 7 → expiry_7d, 3 → expiry_3d, 0 → expired, -3 → renewal_reminder
 */
export async function getSubscriptionsByExpiryOffset(
  daysFromToday: number,
): Promise<StudentSubscriptionRow[]> {
  const supabase = createAdminClient()

  const targetDate = new Date()
  targetDate.setDate(targetDate.getDate() + daysFromToday)
  const targetDateStr = targetDate.toISOString().split('T')[0] // yyyy-MM-dd

  const { data, error } = await supabase
    .from('subscriptions')
    .select(`
      id,
      end_date,
      student_id,
      subscription_plans!inner ( name ),
      profiles!inner ( full_name, phone )
    `)
    .eq('end_date', targetDateStr)

  if (error) throw error

  const rows = data ?? []
  if (rows.length === 0) return []

  // Fetch emails from auth.users via admin API
  const studentIds = rows.map((r: any) => r.student_id)
  const { data: usersData } = await supabase.auth.admin.listUsers()
  const emailMap = new Map<string, string>(
    (usersData?.users ?? [])
      .filter((u) => studentIds.includes(u.id))
      .map((u) => [u.id, u.email ?? '']),
  )

  return rows.map((row: any) => ({
    subscription_id: row.id,
    student_id: row.student_id,
    student_name: row.profiles.full_name,
    student_email: emailMap.get(row.student_id) ?? null,
    student_phone: row.profiles.phone ?? null,
    plan_name: row.subscription_plans.name,
    end_date: row.end_date,
    days_remaining: daysFromToday,
  }))
}
