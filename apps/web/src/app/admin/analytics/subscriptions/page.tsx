import {
  getPlanPopularity,
  getSubscriptionStatusCounts,
  getRevenuePerPlan,
  getAvgDiscount,
} from '@/data/admin/analytics/subscriptions'
import { getLockerStats } from '@/data/admin/analytics/lockers'
import { PlanPieChart } from '@/components/admin/dashboard/plan-pie-chart'
import { SubscriptionStatusCards } from '@/components/admin/analytics/subscription-status-cards'
import { RevenuePerPlanTable } from '@/components/admin/analytics/revenue-per-plan-table'
import { LockerStatsCards } from '@/components/admin/analytics/locker-stats-cards'
import { DateRangeFilter } from '@/components/admin/shared/date-range-filter'
import { Skeleton } from '@/components/ui/skeleton'
import { defaultDateRange } from '@/lib/date-range'
import { BackButton } from '@/components/admin/shared/back-button'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageProps = { searchParams: Promise<{ from?: string; to?: string }> }

export default async function SubscriptionsAnalyticsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const defaults = defaultDateRange()
  const from = params.from ?? defaults.from
  const to = params.to ?? defaults.to

  return (
    <div className="space-y-6 p-6">
      <BackButton />
      <h1 className="text-2xl font-bold">Analyse — Abonnements</h1>
      <DateRangeFilter from={from} to={to} />

      <Suspense
        key={`${from}-${to}`}
        fallback={
          <div className="space-y-6">
            <Skeleton className="h-32 w-full rounded-xl" />
            <div className="grid gap-6 lg:grid-cols-2">
              <Skeleton className="h-72 w-full rounded-xl" />
              <Skeleton className="h-72 w-full rounded-xl" />
            </div>
          </div>
        }
      >
        <SubscriptionsAnalyticsContent from={from} to={to} />
      </Suspense>
    </div>
  )
}

async function SubscriptionsAnalyticsContent({ from, to }: { from: string; to: string }) {
  const asOf = new Date().toISOString().slice(0, 10)

  const [planData, statusCounts, planRevenue, avgDiscount, lockerStats] = await Promise.all([
    getPlanPopularity(),
    getSubscriptionStatusCounts(asOf),
    getRevenuePerPlan({ from, to }),
    getAvgDiscount({ from, to }),
    getLockerStats({ from, to }),
  ])

  return (
    <>
      <SubscriptionStatusCards counts={statusCounts} discount={avgDiscount} />
      <div className="grid gap-6 lg:grid-cols-2">
        <PlanPieChart data={planData} />
        <RevenuePerPlanTable data={planRevenue} />
      </div>
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Casiers
        </h2>
        <LockerStatsCards stats={lockerStats} />
      </div>
    </>
  )
}
