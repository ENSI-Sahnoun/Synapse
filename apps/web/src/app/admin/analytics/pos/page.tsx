import {
  getProductMargin,
  getBestSellers,
  getSalesByCategory,
  getRestockHistory,
  getStockOverPeriod,
} from '@/data/admin/analytics/pos'
import { BestSellersTable } from '@/components/admin/analytics/best-sellers-table'
import { SalesByCategoryChart } from '@/components/admin/analytics/sales-by-category-chart'
import { RestockHistoryTable } from '@/components/admin/analytics/restock-history-table'
import { StockSnapshotTable } from '@/components/admin/analytics/stock-snapshot-table'
import { DateRangeFilter } from '@/components/admin/shared/date-range-filter'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { defaultDateRange } from '@/lib/date-range'
import { BackButton } from '@/components/admin/shared/back-button'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageProps = { searchParams: Promise<{ from?: string; to?: string }> }

export default async function PosAnalyticsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const defaults = defaultDateRange()
  const from = params.from ?? defaults.from
  const to = params.to ?? defaults.to

  return (
    <div className="space-y-6 p-6">
      <BackButton />
      <h1 className="text-2xl font-bold">Analyse — Boutique &amp; produits</h1>
      <DateRangeFilter from={from} to={to} />

      <Suspense
        key={`${from}-${to}`}
        fallback={
          <div className="space-y-6">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-72 w-full rounded-xl" />
          </div>
        }
      >
        <PosAnalyticsContent from={from} to={to} />
      </Suspense>
    </div>
  )
}

async function PosAnalyticsContent({ from, to }: { from: string; to: string }) {
  const [margin, bestSellers, byCategory, restocks, stockSnapshot] = await Promise.all([
    getProductMargin({ from, to }),
    getBestSellers({ from, to }),
    getSalesByCategory({ from, to }),
    getRestockHistory({ from, to }),
    getStockOverPeriod({ from, to }),
  ])

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <BestSellersTable data={bestSellers} />
        <SalesByCategoryChart data={byCategory} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ventes par produits</CardTitle>
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
                  <TableCell colSpan={5} className="animate-in fade-in duration-200 text-center text-muted-foreground">
                    Aucune vente sur la période
                  </TableCell>
                </TableRow>
              ) : (
                margin.map((r) => (
                  <TableRow key={r.productId} className={r.costMissing ? 'bg-amber-50 dark:bg-amber-950/20' : undefined}>
                    <TableCell>
                      {r.productName}
                      {r.costMissing && <span className="ml-1 text-xs text-amber-600">⚠ coût manquant</span>}
                    </TableCell>
                    <TableCell className="text-right text-blue-600">{r.quantitySold}</TableCell>
                    <TableCell className="text-right font-mono text-emerald-600">{r.revenue.toFixed(3)}</TableCell>
                    <TableCell className="text-right font-mono text-red-600">{r.cogs.toFixed(3)}</TableCell>
                    <TableCell
                      className={`text-right font-mono font-semibold ${
                        r.margin > 0 ? 'text-emerald-600' : r.margin < 0 ? 'text-red-600' : 'text-muted-foreground'
                      }`}
                    >
                      {r.margin.toFixed(3)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <StockSnapshotTable rows={stockSnapshot} from={from} to={to} />
        <RestockHistoryTable data={restocks} />
      </div>
    </>
  )
}
