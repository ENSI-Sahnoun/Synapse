import {
  getPeakHours,
  getCurrentOccupancy,
  getAvgSessionDuration,
  getEntryMethodSplit,
} from '@/data/admin/analytics/attendance'
import { PeakHoursHeatmap } from '@/components/admin/analytics/peak-hours-heatmap'
import { DateRangeFilter } from '@/components/admin/shared/date-range-filter'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { defaultDateRange } from '@/lib/date-range'
import { BackButton } from '@/components/admin/shared/back-button'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageProps = { searchParams: Promise<{ from?: string; to?: string }> }

export default async function AttendanceAnalyticsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const defaults = defaultDateRange()
  const from = params.from ?? defaults.from
  const to = params.to ?? defaults.to

  return (
    <div className="space-y-6 p-6">
      <BackButton />
      <h1 className="text-2xl font-bold">Analyse — Fréquentation &amp; occupation</h1>
      <DateRangeFilter from={from} to={to} />

      {/* Shell paints instantly; the heavy queries stream in below. */}
      <Suspense
        key={`${from}-${to}`}
        fallback={
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </div>
            <Skeleton className="h-72 w-full rounded-xl" />
          </div>
        }
      >
        <AttendanceAnalyticsContent from={from} to={to} />
      </Suspense>
    </div>
  )
}

async function AttendanceAnalyticsContent({ from, to }: { from: string; to: string }) {
  const [occupancy, peakHours, sessionDuration, entrySplit] = await Promise.all([
    getCurrentOccupancy(),
    getPeakHours({ from, to }),
    getAvgSessionDuration({ from, to }),
    getEntryMethodSplit({ from, to }),
  ])

  const occupancyPct = occupancy.total > 0 ? Math.round((occupancy.occupied / occupancy.total) * 100) : 0

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Occupation actuelle</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {occupancy.occupied}/{occupancy.total}
            </p>
            <p className="text-sm text-muted-foreground">{occupancyPct}% occupé</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Durée moyenne de session</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{sessionDuration.avgMinutes.toFixed(0)} min</p>
            <p className="text-sm text-muted-foreground">{sessionDuration.sessionsCounted} sessions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Méthode d&apos;entrée</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {entrySplit.length === 0 ? (
              <p className="animate-in fade-in duration-200 text-sm text-muted-foreground">Aucune donnée</p>
            ) : (
              entrySplit.map((e) => (
                <p key={e.method} className="text-sm">
                  {e.method}: <span className="font-semibold">{e.count}</span>
                </p>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <PeakHoursHeatmap data={peakHours} />
    </>
  )
}
