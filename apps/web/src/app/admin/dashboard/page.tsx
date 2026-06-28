import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getLiveSnapshot,
  getDailySummary,
  getRevenueOverTime,
  getStudentTypeSeries,
  getPlanPopularity,
  getCustomMetrics,
} from '@/data/admin/dashboard'
import { LiveIndicators } from '@/components/admin/dashboard/live-indicators'
import { DailySummaryCards } from '@/components/admin/dashboard/daily-summary'
import { RevenueChart } from '@/components/admin/dashboard/revenue-chart'
import { StudentTypeChart } from '@/components/admin/dashboard/student-type-chart'
import { PlanPieChart } from '@/components/admin/dashboard/plan-pie-chart'
import { CustomMetricsChart } from '@/components/admin/dashboard/custom-metrics-chart'
import { LowStockPanel } from '@/components/admin/dashboard/low-stock-panel'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminDashboardPage() {
  const [snapshot, summary, revenueData, studentData, planData, metricsData] =
    await Promise.all([
      getLiveSnapshot(),
      getDailySummary(),
      getRevenueOverTime(30),
      getStudentTypeSeries(30),
      getPlanPopularity(),
      getCustomMetrics(),
    ])

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Tableau de bord</h1>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          En direct
        </h2>
        <Suspense fallback={<Skeleton className="h-28 w-full" />}>
          <LiveIndicators initial={snapshot} />
        </Suspense>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Résumé du jour
        </h2>
        <DailySummaryCards summary={summary} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <RevenueChart data={revenueData} />
        <StudentTypeChart data={studentData} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <PlanPieChart data={planData} />
        <div className="lg:col-span-2">
          <CustomMetricsChart metrics={metricsData} />
        </div>
      </section>

      {snapshot.lowStockProducts.length > 0 && (
        <section>
          <LowStockPanel products={snapshot.lowStockProducts} />
        </section>
      )}
    </div>
  )
}
