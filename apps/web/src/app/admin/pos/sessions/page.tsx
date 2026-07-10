import { Suspense } from 'react'
import {
  getCurrentCashSession,
  getCashSessionHistory,
  getCashSessionsSummary,
} from '@/data/admin/analytics/cash-sessions'
import { CashSessionsSummaryCards } from '@/components/admin/analytics/cash-sessions-summary-cards'
import { CashSessionsTable } from '@/components/admin/analytics/cash-sessions-table'
import { DateRangeFilter } from '@/components/admin/shared/date-range-filter'
import { Skeleton } from '@/components/ui/skeleton'
import { LiveRefresher } from '@/components/live/LiveRefresher'
import { defaultDateRange } from '@/lib/date-range'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageProps = { searchParams: Promise<{ from?: string; to?: string }> }

export default async function CashSessionsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const defaults = defaultDateRange()
  const from = params.from ?? defaults.from
  const to = params.to ?? defaults.to

  return (
    <div className="space-y-6 p-6">
      <LiveRefresher tables={['cash_register_sessions', 'cash_movements']} />
      <h1 className="text-2xl font-bold">Sessions caisse</h1>
      <DateRangeFilter from={from} to={to} />

      <Suspense
        key={`${from}-${to}`}
        fallback={
          <div className="space-y-6">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-72 w-full rounded-xl" />
          </div>
        }
      >
        <CashSessionsContent from={from} to={to} />
      </Suspense>
    </div>
  )
}

async function CashSessionsContent({ from, to }: { from: string; to: string }) {
  const [currentSession, summary, history] = await Promise.all([
    getCurrentCashSession(),
    getCashSessionsSummary(),
    getCashSessionHistory({ from, to }),
  ])

  return (
    <>
      <CashSessionsSummaryCards currentSession={currentSession} summary={summary} />
      <CashSessionsTable data={history} />
    </>
  )
}
