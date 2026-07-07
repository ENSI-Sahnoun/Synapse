import { createSupabaseClient } from '@/supabase-clients/server'

export type EmployeeRevenue = { employeeId: string; fullName: string; revenue: number; transactions: number }
export type ShiftsSummary = { employeeId: string; fullName: string; shiftsWorked: number; salesPerShift: number }

export function salesPerShift(totalSales: number, shiftsWorked: number): number {
  return shiftsWorked > 0 ? totalSales / shiftsWorked : 0
}

export async function getEmployeeRevenue(range: { from: string; to: string }): Promise<EmployeeRevenue[]> {
  const supabase = await createSupabaseClient()

  const [{ data: subs }, { data: purchases }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('sold_by, paid_amount, created_at, profiles!subscriptions_sold_by_fkey(full_name)')
      .gte('created_at', range.from + 'T00:00:00')
      .lte('created_at', range.to + 'T23:59:59'),
    supabase
      .from('purchases')
      .select('sold_by, total_dt, created_at, profiles!purchases_sold_by_fkey(full_name)')
      .gte('created_at', range.from + 'T00:00:00')
      .lte('created_at', range.to + 'T23:59:59'),
  ])

  const map = new Map<string, { fullName: string; revenue: number; transactions: number }>()
  subs?.forEach((r) => {
    const fullName = (r.profiles as unknown as { full_name: string }).full_name
    const existing = map.get(r.sold_by) ?? { fullName, revenue: 0, transactions: 0 }
    existing.revenue += Number(r.paid_amount)
    existing.transactions += 1
    map.set(r.sold_by, existing)
  })
  purchases?.forEach((r) => {
    const fullName = (r.profiles as unknown as { full_name: string }).full_name
    const existing = map.get(r.sold_by) ?? { fullName, revenue: 0, transactions: 0 }
    existing.revenue += Number(r.total_dt)
    existing.transactions += 1
    map.set(r.sold_by, existing)
  })

  return Array.from(map.entries())
    .map(([employeeId, v]) => ({ employeeId, fullName: v.fullName, revenue: v.revenue, transactions: v.transactions }))
    .sort((a, b) => b.revenue - a.revenue)
}

function countMatchingDays(from: string, to: string, daysOfWeek: Set<number>): number {
  const start = new Date(from + 'T00:00:00')
  const end = new Date(to + 'T00:00:00')
  let count = 0
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = (d.getDay() + 6) % 7 // JS: 0=Sun..6=Sat -> 0=Mon..6=Sun
    if (daysOfWeek.has(dow)) count++
  }
  return count
}

export async function getShiftsSummary(range: { from: string; to: string }): Promise<ShiftsSummary[]> {
  const supabase = await createSupabaseClient()

  const [{ data: schedules }, revenue] = await Promise.all([
    supabase
      .from('weekly_schedules')
      .select('employee_id, day_of_week, profiles!weekly_schedules_employee_id_fkey(full_name)'),
    getEmployeeRevenue(range),
  ])

  const revenueMap = new Map(revenue.map((r) => [r.employeeId, r.revenue]))
  const scheduleMap = new Map<string, { fullName: string; daysOfWeek: Set<number> }>()

  schedules?.forEach((r) => {
    const fullName = (r.profiles as unknown as { full_name: string }).full_name
    const existing = scheduleMap.get(r.employee_id) ?? { fullName, daysOfWeek: new Set<number>() }
    existing.daysOfWeek.add(r.day_of_week)
    scheduleMap.set(r.employee_id, existing)
  })

  return Array.from(scheduleMap.entries()).map(([employeeId, v]) => ({
    employeeId,
    fullName: v.fullName,
    shiftsWorked: countMatchingDays(range.from, range.to, v.daysOfWeek),
    salesPerShift: salesPerShift(revenueMap.get(employeeId) ?? 0, countMatchingDays(range.from, range.to, v.daysOfWeek)),
  }))
}
