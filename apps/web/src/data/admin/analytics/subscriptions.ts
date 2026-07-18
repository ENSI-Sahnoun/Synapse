import { createSupabaseClient } from '@/supabase-clients/server'
import { extractPriceChange } from '@/data/admin/price-history-helpers'

export type PlanPopularity = { name: string; value: number }

export async function getPlanPopularity(): Promise<PlanPopularity[]> {
  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('subscriptions')
    .select('plan_id, subscription_plans!inner(name)')
    .is('voided_at', null)

  const map = new Map<string, number>()
  data?.forEach((r) => {
    const name = (r.subscription_plans as { name: string }).name
    map.set(name, (map.get(name) ?? 0) + 1)
  })
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
}

export type SubscriptionStatusCounts = { active: number; expiringSoon: number; expired: number }
export type PlanRevenue = { planName: string; revenue: number; count: number }
export type AvgDiscount = { avgDiscount: number; avgDiscountPct: number }

export function classifySubscriptionStatus(
  endDate: string,
  today: string,
  expiringSoonDays = 7,
): 'active' | 'expiring_soon' | 'expired' {
  if (endDate < today) return 'expired'
  const soonCutoff = new Date(today + 'T00:00:00Z')
  soonCutoff.setUTCDate(soonCutoff.getUTCDate() + expiringSoonDays)
  const cutoffStr = soonCutoff.toISOString().slice(0, 10)
  return endDate <= cutoffStr ? 'expiring_soon' : 'active'
}

export function plansChangedSince(
  logRows: { plan_id: string | null; created_at: string; details: unknown }[],
): (planId: string, since: string) => boolean {
  const latestChangeByPlan = new Map<string, string>()
  for (const r of logRows) {
    if (!r.plan_id) continue
    const priceChange = extractPriceChange(r.details)
    if (!priceChange || priceChange.oldPrice === priceChange.newPrice) continue
    const current = latestChangeByPlan.get(r.plan_id)
    if (!current || r.created_at > current) latestChangeByPlan.set(r.plan_id, r.created_at)
  }
  return (planId: string, since: string) => {
    const latest = latestChangeByPlan.get(planId)
    return latest !== undefined && latest > since
  }
}

export async function getSubscriptionStatusCounts(asOf: string): Promise<SubscriptionStatusCounts> {
  const supabase = await createSupabaseClient()
  const { data } = await supabase.from('subscriptions').select('end_date')

  const counts: SubscriptionStatusCounts = { active: 0, expiringSoon: 0, expired: 0 }
  data?.forEach((r) => {
    const status = classifySubscriptionStatus(r.end_date, asOf)
    if (status === 'active') counts.active++
    else if (status === 'expiring_soon') counts.expiringSoon++
    else counts.expired++
  })
  return counts
}

export async function getRevenuePerPlan(range: { from: string; to: string }): Promise<PlanRevenue[]> {
  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('subscriptions')
    .select('paid_amount, created_at, subscription_plans!inner(name)')
    .gte('created_at', range.from + 'T00:00:00')
    .lte('created_at', range.to + 'T23:59:59')
    .is('voided_at', null)

  const map = new Map<string, { revenue: number; count: number }>()
  data?.forEach((r) => {
    const name = (r.subscription_plans as { name: string }).name
    const existing = map.get(name) ?? { revenue: 0, count: 0 }
    existing.revenue += Number(r.paid_amount)
    existing.count += 1
    map.set(name, existing)
  })

  return Array.from(map.entries())
    .map(([planName, v]) => ({ planName, revenue: v.revenue, count: v.count }))
    .sort((a, b) => b.revenue - a.revenue)
}

export async function getAvgDiscount(range: { from: string; to: string }): Promise<AvgDiscount> {
  const supabase = await createSupabaseClient()
  const [{ data }, { data: logRows }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('plan_id, paid_amount, created_at, subscription_plans!inner(price_dt)')
      .gte('created_at', range.from + 'T00:00:00')
      .lte('created_at', range.to + 'T23:59:59')
      .is('voided_at', null),
    supabase
      .from('subscription_plan_activity_log')
      .select('plan_id, created_at, details')
      .eq('action', 'plan_update'),
  ])

  if (!data || data.length === 0) return { avgDiscount: 0, avgDiscountPct: 0 }

  const changedSince = plansChangedSince(logRows ?? [])

  let totalDiscount = 0
  let totalPrice = 0
  let count = 0
  data.forEach((r) => {
    if (changedSince(r.plan_id, r.created_at)) return
    const price = Number((r.subscription_plans as { price_dt: number }).price_dt)
    const paid = Number(r.paid_amount)
    totalDiscount += price - paid
    totalPrice += price
    count += 1
  })

  if (count === 0) return { avgDiscount: 0, avgDiscountPct: 0 }
  const avgDiscount = totalDiscount / count
  const avgDiscountPct = totalPrice > 0 ? (totalDiscount / totalPrice) * 100 : 0
  return { avgDiscount, avgDiscountPct }
}
