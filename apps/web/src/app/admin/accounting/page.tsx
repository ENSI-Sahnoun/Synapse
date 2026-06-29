import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getExpenses, getPnl, getExpenseCategories } from '@/data/admin/accounting'
import { ExpenseForm } from '@/components/admin/accounting/expense-form'
import { ExpenseTable } from '@/components/admin/accounting/expense-table'
import { PnlTable } from '@/components/admin/accounting/pnl-table'
import { DateRangeFilter } from '@/components/admin/accounting/date-range-filter'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ExportButtons } from '@/components/admin/accounting/export-buttons'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageProps = {
  searchParams: Promise<{ from?: string; to?: string; category_id?: string }>
}

function defaultDateRange(): { from: string; to: string } {
  const now = new Date()
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const to = now.toISOString().slice(0, 10)
  return { from, to }
}

export default async function AccountingPage({ searchParams }: PageProps) {
  const params = await searchParams
  const defaults = defaultDateRange()
  const from = params.from ?? defaults.from
  const to = params.to ?? defaults.to
  const category_id = params.category_id

  const [expenses, pnl, categories] = await Promise.all([
    getExpenses({ from, to, category_id }),
    getPnl({ from, to }),
    getExpenseCategories(),
  ])

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Comptabilité</h1>
        <div className="flex gap-2">
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

        <TabsContent value="pnl">
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
      </Tabs>
    </div>
  )
}
