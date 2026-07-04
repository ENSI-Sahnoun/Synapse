import {
  getPlanPopularity,
  getSubscriptionStatusCounts,
  getRevenuePerPlan,
  getAvgDiscount,
} from '@/data/admin/analytics/subscriptions'
import { PlanPieChart } from '@/components/admin/dashboard/plan-pie-chart'
import { SubscriptionStatusCards } from '@/components/admin/analytics/subscription-status-cards'
import { RevenuePerPlanTable } from '@/components/admin/analytics/revenue-per-plan-table'
import { DateRangeFilter } from '@/components/admin/shared/date-range-filter'
import { defaultDateRange } from '@/lib/date-range'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageProps = { searchParams: Promise<{ from?: string; to?: string }> }

export default async function SubscriptionsAnalyticsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const defaults = defaultDateRange()
  const from = params.from ?? defaults.from
  const to = params.to ?? defaults.to
  const asOf = new Date().toISOString().slice(0, 10)

  const [planData, statusCounts, planRevenue, avgDiscount] = await Promise.all([
    getPlanPopularity(),
    getSubscriptionStatusCounts(asOf),
    getRevenuePerPlan({ from, to }),
    getAvgDiscount({ from, to }),
  ])

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Analyse — Abonnements</h1>
      <DateRangeFilter from={from} to={to} />
      <SubscriptionStatusCards counts={statusCounts} discount={avgDiscount} />
      <div className="grid gap-6 lg:grid-cols-2">
        <PlanPieChart data={planData} />
        <RevenuePerPlanTable data={planRevenue} />
      </div>
    </div>
  )
}
