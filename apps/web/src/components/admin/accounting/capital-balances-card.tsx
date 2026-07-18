import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CapitalBalances } from '@/data/admin/capital'

type Props = { balances: CapitalBalances }

export function CapitalBalancesCard({ balances }: Props) {
  const fmt = (n: number) => `${n.toFixed(3)} DT`

  return (
    <Card>
      <CardHeader>
        <CardTitle>Position de trésorerie</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-sm text-muted-foreground">Caisse</p>
          <p className="text-2xl font-bold">{fmt(balances.cash)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Banque</p>
          <p className="text-2xl font-bold">{fmt(balances.bank)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{fmt(balances.total)}</p>
        </div>
      </CardContent>
    </Card>
  )
}
