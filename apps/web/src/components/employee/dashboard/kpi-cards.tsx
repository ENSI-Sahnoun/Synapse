import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { EmployeeDashboardData } from '@/data/employee/dashboard'

type Props = { data: EmployeeDashboardData }

export function EmployeeKpiCards({ data }: Props) {
  const cards = [
    {
      label: 'Entrées aujourd\'hui',
      value: data.todayCheckIns.toString(),
      sub: 'Check-ins du jour',
    },
    {
      label: 'Présents actuellement',
      value: data.currentlyInside.toString(),
      sub: 'Dans les locaux',
    },
    {
      label: 'Revenu abonnements',
      value: `${data.subscriptionsRevenueToday.toFixed(2)} DT`,
      sub: `${data.subscriptionsSoldToday} abonnement${data.subscriptionsSoldToday > 1 ? 's' : ''} vendu${data.subscriptionsSoldToday > 1 ? 's' : ''}`,
    },
    {
      label: 'Revenu boutique',
      value: `${data.posRevenueToday.toFixed(2)} DT`,
      sub: `${data.posSalesToday} vente${data.posSalesToday > 1 ? 's' : ''} POS`,
    },
    {
      label: 'Occupation des places',
      value: `${data.seatOccupancy.occupied}/${data.seatOccupancy.total}`,
      sub: 'Places occupées',
    },
    {
      label: 'Stock faible',
      value: data.lowStockCount.toString(),
      sub: 'Produits ≤ 5 unités',
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{c.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{c.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
