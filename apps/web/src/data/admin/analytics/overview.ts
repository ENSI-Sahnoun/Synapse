import { createSupabaseClient } from '@/supabase-clients/server'
import { getFinanceSummary, previousPeriod } from '@/data/admin/accounting'
import { getLockersWithStatus } from '@/data/employee/lockers'

export type LiveSnapshot = {
  studentsInside: number
  seatOccupancy: { occupied: number; total: number }
  lockerOccupancy: { occupied: number; total: number }
  todayRevenue: number
  expiringSoonCount: number
  lowStockProducts: Array<{ id: string; name: string; stock_quantity: number }>
}

export type DailySummary = {
  newStudents: number
  subscriptionsSold: number
  subscriptionsRevenue: number
  inStoreSales: number
  footfall: number
}

export type RevenuePoint = { date: string; revenue: number }

const today = () => {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Tunis' }).format(new Date())
}

const startOfTomorrow = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Tunis' }).format(d) + 'T00:00:00'
}

export async function getLiveSnapshot(): Promise<LiveSnapshot> {
  const supabase = await createSupabaseClient()

  const todayStr = today()
  const dayStart = todayStr + 'T00:00:00'
  const dayEnd = startOfTomorrow()

  const weekLater = new Date()
  weekLater.setDate(weekLater.getDate() + 7)
  const weekLaterStr = weekLater.toISOString().slice(0, 10)

  // All nine reads are independent — fire them in parallel. This function runs
  // on every dashboard load AND on every realtime tick, so the serial waterfall
  // it replaced multiplied Supabase latency ~9x on the busiest surface.
  const [
    studentsInsideRes,
    totalSeatsRes,
    occupiedSeatsRes,
    lockers,
    subRevenueRes,
    purchaseRevenueRes,
    lockerRevenueRes,
    expiringSoonRes,
    lowStockRes,
  ] = await Promise.all([
    supabase.from('attendance').select('*', { count: 'exact', head: true }).is('checked_out_at', null),
    supabase.from('seats').select('*', { count: 'exact', head: true }).neq('status', 'out_of_service'),
    supabase.from('seats').select('*', { count: 'exact', head: true }).eq('status', 'occupied'),
    getLockersWithStatus(),
    supabase.from('subscriptions').select('paid_amount').gte('created_at', dayStart).lt('created_at', dayEnd),
    supabase.from('purchases').select('total_dt').gte('created_at', dayStart).lt('created_at', dayEnd),
    supabase.from('locker_payments').select('amount_dt').gte('created_at', dayStart).lt('created_at', dayEnd),
    supabase
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .gte('end_date', todayStr)
      .lte('end_date', weekLaterStr),
    supabase
      .from('products')
      .select('id, name, stock_quantity')
      .eq('is_active', true)
      .lte('stock_quantity', 5)
      .order('stock_quantity', { ascending: true })
      .limit(10),
  ])

  const lockerOccupancy = {
    occupied: lockers.filter((l) => l.status === 'occupied').length,
    total: lockers.length,
  }

  const todayRevenue =
    (subRevenueRes.data?.reduce((s, r) => s + Number(r.paid_amount), 0) ?? 0) +
    (purchaseRevenueRes.data?.reduce((s, r) => s + Number(r.total_dt), 0) ?? 0) +
    (lockerRevenueRes.data?.reduce((s, r) => s + Number(r.amount_dt), 0) ?? 0)

  return {
    studentsInside: studentsInsideRes.count ?? 0,
    seatOccupancy: { occupied: occupiedSeatsRes.count ?? 0, total: totalSeatsRes.count ?? 60 },
    lockerOccupancy,
    todayRevenue,
    expiringSoonCount: expiringSoonRes.count ?? 0,
    lowStockProducts: lowStockRes.data ?? [],
  }
}

export async function getDailySummary(): Promise<DailySummary> {
  const supabase = await createSupabaseClient()
  const todayStr = today()
  const start = todayStr + 'T00:00:00'
  const end = startOfTomorrow()

  const [newStudentsRes, subsRes, purchasesRes, footfallRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'student')
      .gte('created_at', start)
      .lt('created_at', end),
    supabase.from('subscriptions').select('paid_amount').gte('created_at', start).lt('created_at', end),
    supabase.from('purchases').select('total_dt').gte('created_at', start).lt('created_at', end),
    supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .gte('checked_in_at', start)
      .lt('checked_in_at', end),
  ])

  const newStudents = newStudentsRes.count
  const subs = subsRes.data
  const subscriptionsSold = subs?.length ?? 0
  const subscriptionsRevenue = subs?.reduce((s, r) => s + Number(r.paid_amount), 0) ?? 0
  const inStoreSales = purchasesRes.data?.reduce((s, r) => s + Number(r.total_dt), 0) ?? 0
  const footfall = footfallRes.count

  return {
    newStudents: newStudents ?? 0,
    subscriptionsSold,
    subscriptionsRevenue,
    inStoreSales,
    footfall: footfall ?? 0,
  }
}

export async function getRevenueOverTime(days = 30): Promise<RevenuePoint[]> {
  const supabase = await createSupabaseClient()
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().slice(0, 10)

  const { data: subs } = await supabase
    .from('subscriptions')
    .select('paid_amount, created_at')
    .gte('created_at', sinceStr)

  const { data: purchases } = await supabase
    .from('purchases')
    .select('total_dt, created_at')
    .gte('created_at', sinceStr)

  const map = new Map<string, number>()

  subs?.forEach((r) => {
    const d = r.created_at.slice(0, 10)
    map.set(d, (map.get(d) ?? 0) + Number(r.paid_amount))
  })
  purchases?.forEach((r) => {
    const d = r.created_at.slice(0, 10)
    map.set(d, (map.get(d) ?? 0) + Number(r.total_dt))
  })

  // Fill missing days with 0
  const result: RevenuePoint[] = []
  for (let i = days; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    result.push({ date: key, revenue: map.get(key) ?? 0 })
  }
  return result
}

export function diffDelta(current: number, previous: number): number {
  return current - previous
}

export type OverviewKpis = {
  netProfit: number
  netProfitDelta: number
  totalRevenue: number
  totalRevenueDelta: number
  grossMargin: number
  grossMarginDelta: number
  expenses: number
  expensesDelta: number
  activeSubscriptions: number
  activeSubscriptionsDelta: number
  newStudents: number
  newStudentsDelta: number
  cashDiscrepancy: number
  cashDiscrepancyDelta: number
}

const CASH_DISCREPANCY_CATEGORY_ID = '00000000-0000-0000-0000-0000000000ec'

async function sumCashDiscrepancy(
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  from: string,
  to: string,
): Promise<number> {
  const { data } = await supabase
    .from('expenses')
    .select('amount_dt')
    .eq('account_category_id', CASH_DISCREPANCY_CATEGORY_ID)
    .gte('date', from)
    .lte('date', to)
  return data?.reduce((s, r) => s + Number(r.amount_dt), 0) ?? 0
}

async function countActiveSubscriptions(
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  asOf: string,
): Promise<number> {
  const { count } = await supabase
    .from('subscriptions')
    .select('*', { count: 'exact', head: true })
    .lte('start_date', asOf)
    .gte('end_date', asOf)
  return count ?? 0
}

async function countNewStudents(
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  from: string,
  to: string,
): Promise<number> {
  const { count } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'student')
    .gte('created_at', from + 'T00:00:00')
    .lte('created_at', to + 'T23:59:59')
  return count ?? 0
}

export async function getOverviewKpis(range: { from: string; to: string }): Promise<OverviewKpis> {
  const supabase = await createSupabaseClient()
  const prev = previousPeriod(range.from, range.to)

  const [current, previousSummary, activeNow, activePrev, newStudents, newStudentsPrev, cashDiscrepancy, cashDiscrepancyPrev] =
    await Promise.all([
      getFinanceSummary(range),
      getFinanceSummary(prev),
      countActiveSubscriptions(supabase, range.to),
      countActiveSubscriptions(supabase, prev.to),
      countNewStudents(supabase, range.from, range.to),
      countNewStudents(supabase, prev.from, prev.to),
      sumCashDiscrepancy(supabase, range.from, range.to),
      sumCashDiscrepancy(supabase, prev.from, prev.to),
    ])

  return {
    netProfit: current.netProfit,
    netProfitDelta: current.netProfitDelta,
    totalRevenue: current.revenue,
    totalRevenueDelta: diffDelta(current.revenue, previousSummary.revenue),
    grossMargin: current.grossMargin,
    grossMarginDelta: diffDelta(current.grossMargin, previousSummary.grossMargin),
    expenses: current.expenses,
    expensesDelta: diffDelta(current.expenses, previousSummary.expenses),
    activeSubscriptions: activeNow,
    activeSubscriptionsDelta: diffDelta(activeNow, activePrev),
    newStudents,
    newStudentsDelta: diffDelta(newStudents, newStudentsPrev),
    cashDiscrepancy,
    cashDiscrepancyDelta: diffDelta(cashDiscrepancy, cashDiscrepancyPrev),
  }
}
