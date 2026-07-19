import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  getExpenses,
  getPnl,
  getExpenseCategories,
  getFinanceSummary,
  getRevenueSplit,
  getExpensesByCategory,
  getCashFlow,
} from '@/data/admin/accounting'
import { getCapitalBalances, getCapitalHistory } from '@/data/admin/capital'
import { ExpenseForm } from '@/components/admin/accounting/expense-form'
import { ExpenseTable } from '@/components/admin/accounting/expense-table'
import { PnlTable } from '@/components/admin/accounting/pnl-table'
import { NetProfitCard } from '@/components/admin/accounting/net-profit-card'
import { RevenueSplitChart } from '@/components/admin/accounting/revenue-split-chart'
import { ExpensesByCategoryChart } from '@/components/admin/accounting/expenses-by-category-chart'
import { CashFlowChart } from '@/components/admin/accounting/cash-flow-chart'
import { CapitalBalancesCard } from '@/components/admin/accounting/capital-balances-card'
import { RecordCapitalMovementDialog } from '@/components/admin/accounting/record-capital-movement-dialog'
import { RecordCapitalTransferDialog } from '@/components/admin/accounting/record-capital-transfer-dialog'
import { CapitalHistoryTable } from '@/components/admin/accounting/capital-history-table'
import { DateRangeFilter } from '@/components/admin/shared/date-range-filter'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ExportButtons } from '@/components/admin/accounting/export-buttons'
import { defaultDateRange } from '@/lib/date-range'
import { LiveRefresher } from '@/components/live/LiveRefresher'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageProps = {
  searchParams: Promise<{ from?: string; to?: string; category_id?: string }>
}

export default async function AccountingPage({ searchParams }: PageProps) {
  const params = await searchParams
  const defaults = defaultDateRange()
  const from = params.from ?? defaults.from
  const to = params.to ?? defaults.to
  const category_id = params.category_id

  const [
    expenses,
    pnl,
    categories,
    financeSummary,
    revenueSplit,
    expensesByCategory,
    cashFlow,
    capitalBalances,
    capitalHistory,
  ] = await Promise.all([
    getExpenses({ from, to, category_id }),
    getPnl({ from, to }),
    getExpenseCategories(),
    getFinanceSummary({ from, to }),
    getRevenueSplit({ from, to }),
    getExpensesByCategory({ from, to }),
    getCashFlow({ from, to }),
    getCapitalBalances(),
    getCapitalHistory(),
  ])

  return (
    <div className="space-y-6 p-6">
      <LiveRefresher tables={['purchases', 'expenses']} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Comptabilité</h1>
        <div className="flex flex-wrap gap-2">
          <ExportButtons from={from} to={to} />
          <Button variant="outline" asChild>
            <Link href="/admin/accounting/categories">Gérer les catégories</Link>
          </Button>
        </div>
      </div>

      <DateRangeFilter from={from} to={to} />

      <Tabs defaultValue="depenses">
        <TabsList>
          <TabsTrigger value="depenses">Dépenses</TabsTrigger>
          <TabsTrigger value="pnl">Résultat P&amp;L</TabsTrigger>
          <TabsTrigger value="tresorerie">Trésorerie</TabsTrigger>
        </TabsList>

        <TabsContent value="depenses" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Nouvelle dépense</CardTitle>
            </CardHeader>
            <CardContent>
              <ExpenseForm categories={categories} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Dépenses du {new Date(from).toLocaleDateString('fr-FR')} au{' '}
                {new Date(to).toLocaleDateString('fr-FR')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<Skeleton className="h-40 w-full" />}>
                <ExpenseTable expenses={expenses} />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pnl" className="space-y-6">
          <NetProfitCard summary={financeSummary} />

          <div className="grid gap-6 md:grid-cols-2">
            <RevenueSplitChart data={revenueSplit} />
            <ExpensesByCategoryChart data={expensesByCategory} />
          </div>

          <CashFlowChart data={cashFlow} />

          <Card>
            <CardHeader>
              <CardTitle>
                Compte de résultat — {new Date(from).toLocaleDateString('fr-FR')} →{' '}
                {new Date(to).toLocaleDateString('fr-FR')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PnlTable pnl={pnl} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tresorerie" className="space-y-6">
          <CapitalBalancesCard balances={capitalBalances} />

          <div className="flex gap-2">
            <RecordCapitalMovementDialog />
            <RecordCapitalTransferDialog />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Historique</CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<Skeleton className="h-40 w-full" />}>
                <CapitalHistoryTable entries={capitalHistory} />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
