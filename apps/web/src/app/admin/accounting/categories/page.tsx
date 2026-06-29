import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { getAllAccountCategories } from '@/data/admin/account-categories'
import { CategoryTable } from '@/components/admin/accounting/category-table'
import { CategoryFormDialog } from '@/components/admin/accounting/category-form-dialog'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AccountCategoriesPage() {
  const categories = await getAllAccountCategories()

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Catégories de comptes</h1>
          <p className="text-sm text-muted-foreground">
            Les catégories définissent la structure du plan comptable. Toute nouvelle catégorie
            apparaît automatiquement dans les rapports P&amp;L.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/accounting">← Retour à la comptabilité</Link>
          </Button>
          <CategoryFormDialog />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {categories.length} catégorie{categories.length !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-40 w-full" />}>
            <CategoryTable categories={categories} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
