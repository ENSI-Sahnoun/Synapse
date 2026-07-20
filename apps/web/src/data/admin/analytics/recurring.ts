import { createSupabaseClient } from '@/supabase-clients/server'
import { roundDt, tunisDate } from '@/lib/tz'

// The RPCs added by 20260720000500 are not in the hand-maintained
// `database.types.ts` yet, so the client is cast locally per call rather than
// widening the shared types file.
type RpcClient = (fn: string, args?: Record<string, unknown>) => Promise<{
  data: unknown[] | null
  error: { message: string } | null
}>

async function callRpc<Row>(fn: string, args: Record<string, unknown>): Promise<Row[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await (supabase.rpc as unknown as RpcClient)(fn, args)
  if (error) throw new Error(error.message)
  return (data ?? []) as Row[]
}

export type RecurringRevenue = {
  /** Normalised monthly value of every live membership, DT. */
  mrr: number
  arr: number
  activeMembers: number
  arpu: number
  /** Cash collected for service days not yet delivered — a liability, not profit. */
  deferredRevenue: number
  /** Value of memberships lapsing within 30 days of `asOf`. */
  revenueAtRisk30: number
}

type RecurringRevenueRow = {
  mrr: string
  arr: string
  active_members: string
  arpu: string
  deferred_revenue: string
  revenue_at_risk_30: string
}

export async function getRecurringRevenue(asOf: string = tunisDate()): Promise<RecurringRevenue> {
  const rows = await callRpc<RecurringRevenueRow>('analytics_recurring_revenue', { p_as_of: asOf })
  const r = rows[0]
  if (!r) {
    return { mrr: 0, arr: 0, activeMembers: 0, arpu: 0, deferredRevenue: 0, revenueAtRisk30: 0 }
  }

  return {
    mrr: roundDt(Number(r.mrr)),
    arr: roundDt(Number(r.arr)),
    activeMembers: Number(r.active_members),
    arpu: roundDt(Number(r.arpu)),
    deferredRevenue: roundDt(Number(r.deferred_revenue)),
    revenueAtRisk30: roundDt(Number(r.revenue_at_risk_30)),
  }
}

export type RecognizedRevenue = {
  /** Accrual basis: the share of each membership actually delivered in the window. */
  recognized: number
  /** Cash basis: everything invoiced inside the window, whenever it is delivered. */
  cashCollected: number
  /**
   * `cashCollected - recognized`. A large positive number means the period's
   * profit is flattered by lump-sum prepayments the business has not yet
   * earned; a negative one means it is living off cash banked earlier.
   */
  difference: number
}

type RecognizedRevenueRow = { recognized: string; cash_collected: string }

/** Pure so the sign convention can be pinned in a test. */
export function recognizedDifference(cashCollected: number, recognized: number): number {
  return roundDt(cashCollected - recognized)
}

export async function getRecognizedRevenue(range: {
  from: string
  to: string
}): Promise<RecognizedRevenue> {
  const rows = await callRpc<RecognizedRevenueRow>('analytics_recognized_revenue', {
    p_from: range.from,
    p_to: range.to,
  })
  const r = rows[0]
  const recognized = roundDt(Number(r?.recognized ?? 0))
  const cashCollected = roundDt(Number(r?.cash_collected ?? 0))

  return { recognized, cashCollected, difference: recognizedDifference(cashCollected, recognized) }
}

export type Churn = {
  /** Members whose membership lapsed inside the window, deduplicated per member. */
  cohort: number
  renewed: number
  churned: number
  /**
   * Null when the cohort is empty: nobody was up for renewal, which is not the
   * same as a 0% renewal rate. The UI must render "—", never a percentage.
   */
  renewalRatePct: number | null
  churnRatePct: number | null
  avgLifetimeDays: number
  /** Observed lifetime spend per member, not an ARPU/churn projection. */
  ltv: number
}

type ChurnRow = {
  cohort: string
  renewed: string
  churned: string
  renewal_rate_pct: string | null
  churn_rate_pct: string | null
  avg_lifetime_days: string
  ltv: string
}

/** `Number(null)` is 0, which would turn "no cohort" into a confident 0%. */
export function numberOrNull(v: string | null): number | null {
  return v === null ? null : Number(v)
}

export async function getChurn(range: { from: string; to: string }): Promise<Churn> {
  const rows = await callRpc<ChurnRow>('analytics_churn', { p_from: range.from, p_to: range.to })
  const r = rows[0]
  if (!r) {
    return {
      cohort: 0,
      renewed: 0,
      churned: 0,
      renewalRatePct: null,
      churnRatePct: null,
      avgLifetimeDays: 0,
      ltv: 0,
    }
  }

  return {
    cohort: Number(r.cohort),
    renewed: Number(r.renewed),
    churned: Number(r.churned),
    renewalRatePct: numberOrNull(r.renewal_rate_pct),
    churnRatePct: numberOrNull(r.churn_rate_pct),
    avgLifetimeDays: Number(r.avg_lifetime_days),
    ltv: roundDt(Number(r.ltv)),
  }
}

export type MrrPoint = { month: string; mrr: number }

/**
 * The last `months` month-end dates in Tunis calendar space, oldest first.
 *
 * The most recent entry is clamped to `today`: the current month has not ended
 * yet, and asking for MRR at a future date would count memberships that are
 * scheduled to start but have not, inflating the newest point on the chart.
 */
export function monthEndDates(months: number, today: string = tunisDate()): string[] {
  const [year, month] = today.split('-').map(Number)
  const pad = (n: number) => String(n).padStart(2, '0')

  const dates: string[] = []
  for (let back = months - 1; back >= 0; back--) {
    // `Date.UTC(y, m, 0)` is the last day of month `m` (1-based).
    const end = new Date(Date.UTC(year, month - back, 0))
    const iso = `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())}`
    dates.push(iso > today ? today : iso)
  }
  return dates
}

/** MRR at each of the last `months` month-ends, for charting. */
export async function getMrrTrend(months: number): Promise<MrrPoint[]> {
  const dates = monthEndDates(months)
  const snapshots = await Promise.all(dates.map((d) => getRecurringRevenue(d)))
  return dates.map((d, i) => ({ month: d.slice(0, 7), mrr: snapshots[i]!.mrr }))
}
