import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { OverviewKpis } from '@/data/admin/analytics/overview'

type Props = { kpis: OverviewKpis }

function DeltaBadge({ value, unit }: { value: number; unit: 'DT' | 'count' }) {
  const positive = value >= 0
  return (
    <span className={`text-xs font-medium ${positive ? 'text-green-600' : 'text-red-600'}`}>
      {positive ? '▲' : '▼'} {Math.abs(value).toFixed(unit === 'DT' ? 3 : 0)}
      {unit === 'DT' ? ' DT' : ''}
    </span>
  )
}

export function KpiTiles({ kpis }: Props) {
  const tiles: Array<{ label: string; value: string; delta: number; unit: 'DT' | 'count' }> = [
    { label: 'Bénéfice net', value: `${kpis.netProfit.toFixed(3)} DT`, delta: kpis.netProfitDelta, unit: 'DT' },
    {
      label: 'Revenus totaux',
      value: `${kpis.totalRevenue.toFixed(3)} DT`,
      delta: kpis.totalRevenueDelta,
      unit: 'DT',
    },
    {
      label: 'Marge brute',
      value: `${kpis.grossMargin.toFixed(3)} DT`,
      delta: kpis.grossMarginDelta,
      unit: 'DT',
    },
    {
      label: 'Abonnements actifs',
      value: kpis.activeSubscriptions.toString(),
      delta: kpis.activeSubscriptionsDelta,
      unit: 'count',
    },
    {
      label: 'Nouveaux étudiants',
      value: kpis.newStudents.toString(),
      delta: kpis.newStudentsDelta,
      unit: 'count',
    },
    { label: 'Dépenses', value: `${kpis.expenses.toFixed(3)} DT`, delta: kpis.expensesDelta, unit: 'DT' },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
      {tiles.map((t) => (
        <Card key={t.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t.label}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-xl font-bold">{t.value}</p>
            <DeltaBadge value={t.delta} unit={t.unit} />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
