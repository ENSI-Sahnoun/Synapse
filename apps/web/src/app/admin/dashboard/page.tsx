import Link from 'next/link'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { getLiveSnapshot, getOverviewKpis } from '@/data/admin/analytics/overview'
import { getRevenueSplit, getCashFlow } from '@/data/admin/accounting'
import { getTopStudentsByLoyalty, getTopStudentsBySpend } from '@/data/admin/analytics/students'
import { getEmployeeRevenue, getShiftsSummary } from '@/data/admin/analytics/staff'
import { LiveIndicators } from '@/components/admin/dashboard/live-indicators'
import { KpiTiles } from '@/components/admin/dashboard/kpi-tiles'
import { RevenueSplitChart } from '@/components/admin/accounting/revenue-split-chart'
import { CashFlowChart } from '@/components/admin/accounting/cash-flow-chart'
import { TopStudentsTable } from '@/components/admin/analytics/top-students-table'
import { EmployeeRevenueTable } from '@/components/admin/analytics/employee-revenue-table'
import { defaultDateRange } from '@/lib/date-range'
import { LiveRefresher } from '@/components/live/LiveRefresher'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminDashboardPage() {
  const { from, to } = defaultDateRange()

  const [snapshot, kpis, revenueSplit, cashFlow, topByLoyalty, topBySpend, employeeRevenue, shiftsSummary] =
    await Promise.all([
      getLiveSnapshot(),
      getOverviewKpis({ from, to }),
      getRevenueSplit({ from, to }),
      getCashFlow({ from, to }),
      getTopStudentsByLoyalty(5),
      getTopStudentsBySpend({ from, to }, 5),
      getEmployeeRevenue({ from, to }),
      getShiftsSummary({ from, to }),
    ])

  return (
    <div className="space-y-6 p-6">
      <LiveRefresher tables={['attendance', 'purchases', 'subscriptions', 'reservations', 'lockers', 'locker_payments']} />
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
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Étudiants &amp; personnel — ce mois
          </h2>
          <Link
            href="/admin/analytics/students-staff"
            className="text-sm font-medium text-primary hover:underline"
          >
            Détails →
          </Link>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <TopStudentsTable byLoyalty={topByLoyalty} bySpend={topBySpend} />
          <EmployeeRevenueTable revenue={employeeRevenue} shifts={shiftsSummary} />
        </div>
      </section>
    </div>
  )
}
