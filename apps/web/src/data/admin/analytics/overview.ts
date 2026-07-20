import { createSupabaseClient } from '@/supabase-clients/server'
import { getFinanceSummary, pctDelta, previousPeriod } from '@/data/admin/accounting'
import { getLockersWithStatus } from '@/data/employee/lockers'
import { CASH_DISCREPANCY_CATEGORY_ID } from '@/lib/accounting-constants'
import { addDays, enumerateDays, roundDt, tunisDate, tunisDayStart, tunisRange } from '@/lib/tz'

export type LiveSnapshot = {
  studentsInside: number
  seatOccupancy: { occupied: number; total: number }
  lockerOccupancy: { occupied: number; total: number }
  todayRevenue: number
  expiringSoonCount: number
  /** Dinars tied to those expiring subscriptions — the renewal actually at stake. */
  expiringSoonValue: number
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

// Day boundaries come from lib/tz so this file, `accounting.ts` and
// `date-range.ts` all agree on when a business day starts. The inline
// formatter that used to live here produced bare `'...T00:00:00'` strings
// with no offset, which PostgREST resolved as UTC — so the Tunis formatting
// was undone at the query boundary.
export async function getLiveSnapshot(): Promise<LiveSnapshot> {
  const supabase = await createSupabaseClient()

  const todayStr = tunisDate()
  const dayStart = tunisDayStart(todayStr)
  const dayEnd = tunisDayStart(addDays(todayStr, 1))
  const weekLaterStr = addDays(todayStr, 7)

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
    supabase
      .from('subscriptions')
      .select('paid_amount')
      .gte('created_at', dayStart)
      .lt('created_at', dayEnd)
      .is('voided_at', null),
    supabase
      .from('purchases')
      .select('total_dt')
      .gte('created_at', dayStart)
      .lt('created_at', dayEnd)
      .is('voided_at', null),
    supabase.from('locker_payments').select('amount_dt').gte('created_at', dayStart).lt('created_at', dayEnd),
    // Selects `paid_amount` rather than a head-only count so the same query
    // yields both the count and the dinars at risk. An expiring-member count
    // says nothing about exposure: five students on the cheapest plan and five
    // on annual plans are the same number and wildly different problems.
    supabase
      .from('subscriptions')
      .select('paid_amount')
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

  const expiring = expiringSoonRes.data ?? []

  return {
    studentsInside: studentsInsideRes.count ?? 0,
    seatOccupancy: { occupied: occupiedSeatsRes.count ?? 0, total: totalSeatsRes.count ?? 60 },
    lockerOccupancy,
    todayRevenue: roundDt(todayRevenue),
    expiringSoonCount: expiring.length,
    expiringSoonValue: roundDt(expiring.reduce((s, r) => s + Number(r.paid_amount), 0)),
    lowStockProducts: lowStockRes.data ?? [],
  }
}

export async function getDailySummary(): Promise<DailySummary> {
  const supabase = await createSupabaseClient()
  const todayStr = tunisDate()
  const start = tunisDayStart(todayStr)
  const end = tunisDayStart(addDays(todayStr, 1))

  const [newStudentsRes, subsRes, purchasesRes, footfallRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'student')
      .gte('created_at', start)
      .lt('created_at', end),
    supabase
      .from('subscriptions')
      .select('paid_amount')
      .gte('created_at', start)
      .lt('created_at', end)
      .is('voided_at', null),
    supabase
      .from('purchases')
      .select('total_dt')
      .gte('created_at', start)
      .lt('created_at', end)
      .is('voided_at', null),
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

  // The old loop ran `days` down to 0 inclusive — 31 points for a "30 day"
  // chart — and mixed conventions: `setDate` mutates in local time while
  // `toISOString()` reads UTC, so bucket keys and row keys could disagree.
  // `since` was also a bare date used with `.gte`, one day earlier than the
  // first plotted bucket, leaving a partial leading point that rendered as a
  // phantom downturn.
  const today = tunisDate()
  const firstDay = addDays(today, -(days - 1))
  const { start, endExclusive } = tunisRange(firstDay, today)

  const [{ data: subs }, { data: purchases }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('paid_amount, created_at')
      .gte('created_at', start)
      .lt('created_at', endExclusive)
      .is('voided_at', null),
    supabase
      .from('purchases')
      .select('total_dt, created_at')
      .gte('created_at', start)
      .lt('created_at', endExclusive)
      .is('voided_at', null),
  ])

  const map = new Map<string, number>()
  subs?.forEach((r) => {
    const d = tunisDate(new Date(r.created_at))
    map.set(d, (map.get(d) ?? 0) + Number(r.paid_amount))
  })
  purchases?.forEach((r) => {
    const d = tunisDate(new Date(r.created_at))
    map.set(d, (map.get(d) ?? 0) + Number(r.total_dt))
  })

  return enumerateDays(firstDay, today).map((date) => ({
    date,
    revenue: roundDt(map.get(date) ?? 0),
  }))
}

export function diffDelta(current: number, previous: number): number {
  return roundDt(current - previous)
}

export type OverviewKpis = {
  netProfit: number
  netProfitDelta: number
  netProfitDeltaPct: number | null
  totalRevenue: number
  totalRevenueDelta: number
  totalRevenueDeltaPct: number | null
  grossMargin: number
  grossMarginDelta: number
  grossMarginPct: number
  netMarginPct: number
  expenses: number
  expensesDelta: number
  expensesDeltaPct: number | null
  /** Total cashier discounts granted — a control metric, previously unreported. */
  discounts: number
  activeSubscriptions: number
  activeSubscriptionsDelta: number
  newStudents: number
  newStudentsDelta: number
  cashDiscrepancy: number
  cashDiscrepancyDelta: number
}

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
    .is('voided_at', null)
  return count ?? 0
}

async function countNewStudents(
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  from: string,
  to: string,
): Promise<number> {
  const { start, endExclusive } = tunisRange(from, to)
  const { count } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'student')
    .gte('created_at', start)
    .lt('created_at', endExclusive)
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
    netProfitDeltaPct: current.netProfitDeltaPct,
    totalRevenue: current.revenue,
    totalRevenueDelta: diffDelta(current.revenue, previousSummary.revenue),
    totalRevenueDeltaPct: pctDelta(current.revenue, previousSummary.revenue),
    grossMargin: current.grossMargin,
    grossMarginDelta: diffDelta(current.grossMargin, previousSummary.grossMargin),
    grossMarginPct: current.grossMarginPct,
    netMarginPct: current.netMarginPct,
    expenses: current.expenses,
    expensesDelta: diffDelta(current.expenses, previousSummary.expenses),
    expensesDeltaPct: pctDelta(current.expenses, previousSummary.expenses),
    discounts: current.discounts,
    activeSubscriptions: activeNow,
    activeSubscriptionsDelta: diffDelta(activeNow, activePrev),
    newStudents,
    newStudentsDelta: diffDelta(newStudents, newStudentsPrev),
    cashDiscrepancy,
    cashDiscrepancyDelta: diffDelta(cashDiscrepancy, cashDiscrepancyPrev),
  }
}
