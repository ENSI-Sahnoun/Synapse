import {
  getProductMargin,
  getBestSellers,
  getSalesByCategory,
  getRestockHistory,
  getLowStockList,
} from '@/data/admin/analytics/pos'
import { BestSellersTable } from '@/components/admin/analytics/best-sellers-table'
import { SalesByCategoryChart } from '@/components/admin/analytics/sales-by-category-chart'
import { RestockHistoryTable } from '@/components/admin/analytics/restock-history-table'
import { LowStockPanel } from '@/components/admin/dashboard/low-stock-panel'
import { DateRangeFilter } from '@/components/admin/shared/date-range-filter'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { defaultDateRange } from '@/lib/date-range'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageProps = { searchParams: Promise<{ from?: string; to?: string }> }

export default async function PosAnalyticsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const defaults = defaultDateRange()
  const from = params.from ?? defaults.from
  const to = params.to ?? defaults.to

  const [margin, bestSellers, byCategory, restocks, lowStock] = await Promise.all([
    getProductMargin({ from, to }),
    getBestSellers({ from, to }),
    getSalesByCategory({ from, to }),
    getRestockHistory({ from, to }),
    getLowStockList(),
  ])

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Analyse — Boutique &amp; produits</h1>
      <DateRangeFilter from={from} to={to} />

      <div className="grid gap-6 lg:grid-cols-2">
        <BestSellersTable data={bestSellers} />
        <SalesByCategoryChart data={byCategory} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Marge brute par produit</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead className="text-right">Qté</TableHead>
                <TableHead className="text-right">Revenus (DT)</TableHead>
                <TableHead className="text-right">COGS (DT)</TableHead>
                <TableHead className="text-right">Marge (DT)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {margin.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Aucune vente sur la période
                  </TableCell>
                </TableRow>
              ) : (
                margin.map((r) => (
                  <TableRow key={r.productId}>
                    <TableCell>
                      {r.productName}
                      {r.costMissing && <span className="ml-1 text-xs text-amber-600">⚠ coût manquant</span>}
                    </TableCell>
                    <TableCell className="text-right">{r.quantitySold}</TableCell>
                    <TableCell className="text-right font-mono">{r.revenue.toFixed(3)}</TableCell>
                    <TableCell className="text-right font-mono">{r.cogs.toFixed(3)}</TableCell>
                    <TableCell className="text-right font-mono">{r.margin.toFixed(3)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <LowStockPanel products={lowStock} />
        <RestockHistoryTable data={restocks} />
      </div>
    </div>
  )
}
