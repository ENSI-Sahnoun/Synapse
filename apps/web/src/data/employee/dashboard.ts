import { createSupabaseClient as createSupabaseServerClient } from '@/supabase-clients/server'

export type EmployeeDashboardData = {
  todayCheckIns: number
  currentlyInside: number
  subscriptionsSoldToday: number
  subscriptionsRevenueToday: number
}

export async function getEmployeeDashboardData(): Promise<EmployeeDashboardData> {
  const supabase = await createSupabaseServerClient()

  const todayStr = new Date().toISOString().slice(0, 10)
  const start = todayStr + 'T00:00:00'
  const end = todayStr + 'T23:59:59'

  // Total check-ins today (any attendance row with checked_in_at today)
  const { count: todayCheckIns } = await supabase
    .from('attendance')
    .select('*', { count: 'exact', head: true })
    .gte('checked_in_at', start)
    .lte('checked_in_at', end)

  // Currently inside (open attendance rows — no checkout)
  const { count: currentlyInside } = await supabase
    .from('attendance')
    .select('*', { count: 'exact', head: true })
    .is('checked_out_at', null)

  // Subscriptions sold today
  const { data: subs } = await supabase
    .from('subscriptions')
    .select('paid_amount')
    .gte('created_at', start)
    .lte('created_at', end)

  const subscriptionsSoldToday = subs?.length ?? 0
  const subscriptionsRevenueToday = subs?.reduce((s, r) => s + Number(r.paid_amount), 0) ?? 0

  return {
    todayCheckIns: todayCheckIns ?? 0,
    currentlyInside: currentlyInside ?? 0,
    subscriptionsSoldToday,
    subscriptionsRevenueToday,
  }
}
