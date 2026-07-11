import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { LockerStats } from '@/data/admin/analytics/lockers'

type Props = { stats: LockerStats }

export function LockerStatsCards({ stats }: Props) {
  const tiles = [
    { label: 'Occupés', value: `${stats.occupied}/${stats.total}` },
    { label: 'Libres', value: stats.available.toString() },
    { label: 'Indisponibles', value: stats.unavailable.toString() },
    { label: 'Attributions (période)', value: stats.assignmentsInRange.toString() },
    { label: 'Revenus casiers (période)', value: `${stats.revenueInRange.toFixed(3)} DT` },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
      {tiles.map((t) => (
        <Card key={t.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{t.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
