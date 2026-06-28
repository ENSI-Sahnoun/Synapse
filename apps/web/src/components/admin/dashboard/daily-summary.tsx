import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DailySummary } from '@/data/admin/dashboard'

type Props = { summary: DailySummary }

export function DailySummaryCards({ summary }: Props) {
  const cards = [
    { label: 'Nouveaux étudiants', value: summary.newStudents.toString() },
    {
      label: 'Abonnements vendus',
      value: `${summary.subscriptionsSold} — ${summary.subscriptionsRevenue.toFixed(2)} DT`,
    },
    { label: 'Ventes en magasin', value: `${summary.inStoreSales.toFixed(2)} DT` },
    { label: 'Fréquentation totale', value: summary.footfall.toString() },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{c.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
