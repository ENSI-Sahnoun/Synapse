import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { EmployeeDashboardData } from '@/data/employee/dashboard'
import { LogIn, Users, CreditCard, ShoppingBag, Armchair, PackageX } from 'lucide-react'
import type { ComponentType } from 'react'

type Props = { data: EmployeeDashboardData }

type Accent = { fg: string; bg: string }

const ACCENTS = {
  brown: { fg: 'var(--synapse-brown-600)', bg: 'var(--synapse-brown-50)' },
  orange: { fg: 'var(--synapse-orange-600)', bg: 'var(--synapse-orange-50)' },
  green: { fg: 'var(--synapse-green-700)', bg: 'var(--synapse-green-50)' },
  stone: { fg: 'var(--synapse-stone-600)', bg: 'var(--synapse-stone-100)' },
  warning: { fg: 'var(--warning)', bg: 'var(--synapse-orange-50)' },
  destructive: { fg: 'var(--destructive)', bg: '#FDEDEA' },
} as const satisfies Record<string, Accent>

function stockAccent(count: number): Accent {
  if (count === 0) return ACCENTS.green
  if (count < 5) return ACCENTS.warning
  return ACCENTS.destructive
}

export function EmployeeKpiCards({ data }: Props) {
  const cards: { label: string; value: string; sub: string; icon: ComponentType<{ size?: number }>; accent: Accent }[] = [
    {
      label: 'Entrées aujourd\'hui',
      value: data.todayCheckIns.toString(),
      sub: 'Check-ins du jour',
      icon: LogIn,
      accent: ACCENTS.brown,
    },
    {
      label: 'Présents actuellement',
      value: data.currentlyInside.toString(),
      sub: 'Dans les locaux',
      icon: Users,
      accent: ACCENTS.orange,
    },
    {
      label: 'Revenu abonnements',
      value: `${data.subscriptionsRevenueToday.toFixed(2)} DT`,
      sub: `${data.subscriptionsSoldToday} abonnement${data.subscriptionsSoldToday > 1 ? 's' : ''} vendu${data.subscriptionsSoldToday > 1 ? 's' : ''}`,
      icon: CreditCard,
      accent: ACCENTS.green,
    },
    {
      label: 'Revenu boutique',
      value: `${data.posRevenueToday.toFixed(2)} DT`,
      sub: `${data.posSalesToday} vente${data.posSalesToday > 1 ? 's' : ''} POS`,
      icon: ShoppingBag,
      accent: ACCENTS.green,
    },
    {
      label: 'Occupation des places',
      value: `${data.seatOccupancy.occupied}/${data.seatOccupancy.total}`,
      sub: 'Places occupées',
      icon: Armchair,
      accent: ACCENTS.stone,
    },
    {
      label: 'Stock faible',
      value: data.lowStockCount.toString(),
      sub: 'Produits ≤ 5 unités',
      icon: PackageX,
      accent: stockAccent(data.lowStockCount),
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => (
        <Card key={c.label} className="overflow-hidden" style={{ borderTopColor: c.accent.fg, borderTopWidth: 3 }}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <div
                className="flex items-center justify-center rounded-full"
                style={{ width: 28, height: 28, background: c.accent.bg, color: c.accent.fg }}
              >
                <c.icon size={14} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold" style={{ color: c.accent.fg }}>{c.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{c.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
