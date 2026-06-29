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
      label: 'Abonnements vendus',
      value: data.subscriptionsSoldToday.toString(),
      sub: `${data.subscriptionsRevenueToday.toFixed(2)} DT encaissés`,
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-3">
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
