import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { SubscriptionStatusCounts, AvgDiscount } from '@/data/admin/analytics/subscriptions'

type Props = { counts: SubscriptionStatusCounts; discount: AvgDiscount }

export function SubscriptionStatusCards({ counts, discount }: Props) {
  const tiles = [
    { label: 'Actifs', value: counts.active.toString() },
    { label: 'Expirent bientôt (≤7j)', value: counts.expiringSoon.toString() },
    { label: 'Expirés', value: counts.expired.toString() },
    {
      label: 'Remise moyenne',
      value: `${discount.avgDiscount.toFixed(3)} DT (${discount.avgDiscountPct.toFixed(1)}%)`,
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
