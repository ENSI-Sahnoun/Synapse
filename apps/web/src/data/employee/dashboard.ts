import { createSupabaseClient as createSupabaseServerClient } from '@/supabase-clients/server'

export type EmployeeDashboardData = {
  todayCheckIns: number
  currentlyInside: number
  subscriptionsSoldToday: number
  subscriptionsRevenueToday: number
  posSalesToday: number
  posRevenueToday: number
  seatOccupancy: { occupied: number; total: number }
  lowStockCount: number
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

  // POS sales today
  const { data: purchases } = await supabase
    .from('purchases')
    .select('total_dt')
    .gte('created_at', start)
    .lte('created_at', end)

  const posSalesToday = purchases?.length ?? 0
  const posRevenueToday = purchases?.reduce((s, r) => s + Number(r.total_dt), 0) ?? 0

  // Seat occupancy
  const { count: totalSeats } = await supabase
    .from('seats')
    .select('*', { count: 'exact', head: true })
    .neq('status', 'out_of_service')

  const { count: occupiedSeats } = await supabase
    .from('seats')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'occupied')

  // Low-stock products (stock <= 5)
  const { count: lowStockCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .lte('stock_quantity', 5)

  return {
    todayCheckIns: todayCheckIns ?? 0,
    currentlyInside: currentlyInside ?? 0,
    subscriptionsSoldToday,
    subscriptionsRevenueToday,
    posSalesToday,
    posRevenueToday,
    seatOccupancy: { occupied: occupiedSeats ?? 0, total: totalSeats ?? 0 },
    lowStockCount: lowStockCount ?? 0,
  }
}
