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

export async function getShiftsSummary(range: { from: string; to: string }): Promise<ShiftsSummary[]> {
  const supabase = await createSupabaseClient()

  const [{ data: shifts }, revenue] = await Promise.all([
    supabase
      .from('shifts')
      .select('employee_id, start_time, profiles!shifts_employee_id_fkey(full_name)')
      .gte('start_time', range.from + 'T00:00:00')
      .lte('start_time', range.to + 'T23:59:59'),
    getEmployeeRevenue(range),
  ])

  const revenueMap = new Map(revenue.map((r) => [r.employeeId, r.revenue]))
  const shiftMap = new Map<string, { fullName: string; shiftsWorked: number }>()

  shifts?.forEach((r) => {
    const fullName = (r.profiles as unknown as { full_name: string }).full_name
    const existing = shiftMap.get(r.employee_id) ?? { fullName, shiftsWorked: 0 }
    existing.shiftsWorked += 1
    shiftMap.set(r.employee_id, existing)
  })

  return Array.from(shiftMap.entries()).map(([employeeId, v]) => ({
    employeeId,
    fullName: v.fullName,
    shiftsWorked: v.shiftsWorked,
    salesPerShift: salesPerShift(revenueMap.get(employeeId) ?? 0, v.shiftsWorked),
  }))
}
