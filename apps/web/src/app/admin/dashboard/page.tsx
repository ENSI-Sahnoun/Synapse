import Link from 'next/link'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { getLiveSnapshot, getCustomMetrics, getOverviewKpis } from '@/data/admin/analytics/overview'
import { getRevenueSplit, getCashFlow } from '@/data/admin/accounting'
import { LiveIndicators } from '@/components/admin/dashboard/live-indicators'
import { KpiTiles } from '@/components/admin/dashboard/kpi-tiles'
import { RevenueSplitChart } from '@/components/admin/accounting/revenue-split-chart'
import { CashFlowChart } from '@/components/admin/accounting/cash-flow-chart'
import { CustomMetricsChart } from '@/components/admin/dashboard/custom-metrics-chart'
import { LowStockPanel } from '@/components/admin/dashboard/low-stock-panel'
import { defaultDateRange } from '@/lib/date-range'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminDashboardPage() {
  const { from, to } = defaultDateRange()

  const [snapshot, metricsData, kpis, revenueSplit, cashFlow] = await Promise.all([
    getLiveSnapshot(),
    getCustomMetrics(),
    getOverviewKpis({ from, to }),
    getRevenueSplit({ from, to }),
    getCashFlow({ from, to }),
  ])

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Tableau de bord</h1>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            En direct
          </h2>
          <Link href="/admin/analytics/attendance" className="text-sm font-medium text-primary hover:underline">
            Fréquentation →
          </Link>
        </div>
        <Suspense fallback={<Skeleton className="h-28 w-full" />}>
          <LiveIndicators initial={snapshot} />
        </Suspense>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Indicateurs clés — ce mois
          </h2>
          <Link href="/admin/accounting" className="text-sm font-medium text-primary hover:underline">
            Voir la comptabilité →
          </Link>
        </div>
        <KpiTiles kpis={kpis} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Revenus</h3>
            <Link
              href="/admin/analytics/subscriptions"
              className="text-xs font-medium text-primary hover:underline"
            >
              Abonnements →
            </Link>
          </div>
          <RevenueSplitChart data={revenueSplit} />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Trésorerie</h3>
            <Link href="/admin/analytics/pos" className="text-xs font-medium text-primary hover:underline">
              Boutique →
            </Link>
          </div>
          <CashFlowChart data={cashFlow} />
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">Métriques personnalisées</h3>
          <Link
            href="/admin/analytics/students-staff"
            className="text-xs font-medium text-primary hover:underline"
          >
            Étudiants &amp; personnel →
          </Link>
        </div>
        <CustomMetricsChart metrics={metricsData} />
      </section>

      {snapshot.lowStockProducts.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Stock</h3>
            <Link href="/admin/analytics/pos" className="text-xs font-medium text-primary hover:underline">
              Boutique &amp; produits →
            </Link>
          </div>
          <LowStockPanel products={snapshot.lowStockProducts} />
        </section>
      )}
    </div>
  )
}
