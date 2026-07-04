import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { FinanceSummary } from '@/data/admin/accounting'

type Props = { summary: FinanceSummary }

export function NetProfitCard({ summary }: Props) {
  const { netProfit, netProfitDelta, revenue, grossMargin, expenses, missingCostProducts } = summary
  const deltaPositive = netProfitDelta >= 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Résultat net</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          className={`rounded-lg border-2 p-4 ${
            netProfit >= 0 ? 'border-green-500 bg-green-50' : 'border-red-400 bg-red-50'
          }`}
        >
          <p className="text-sm font-medium text-muted-foreground">
            Bénéfice net (revenus − COGS − dépenses)
          </p>
          <p className={`text-3xl font-bold ${netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {netProfit >= 0 ? '+' : ''}
            {netProfit.toFixed(3)} DT
          </p>
          <p className={`text-sm font-medium ${deltaPositive ? 'text-green-600' : 'text-red-600'}`}>
            {deltaPositive ? '▲' : '▼'} {Math.abs(netProfitDelta).toFixed(3)} DT vs période précédente
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Revenus</p>
            <p className="font-mono font-semibold">{revenue.toFixed(3)} DT</p>
          </div>
          <div>
            <p className="text-muted-foreground">Marge brute</p>
            <p className="font-mono font-semibold">{grossMargin.toFixed(3)} DT</p>
          </div>
          <div>
            <p className="text-muted-foreground">Dépenses</p>
            <p className="font-mono font-semibold">{expenses.toFixed(3)} DT</p>
          </div>
        </div>
        {missingCostProducts > 0 && (
          <p className="text-xs text-amber-600">
            ⚠ {missingCostProducts} produit(s) sans prix de revient — marge sous-estimée
          </p>
        )}
      </CardContent>
    </Card>
  )
}
