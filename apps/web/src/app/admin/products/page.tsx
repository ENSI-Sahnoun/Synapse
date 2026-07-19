import { listAllProducts } from '@/data/admin/products'
import { listProductCategories } from '@/data/admin/product-categories'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ProductsTable } from './products-table'
import { LiveRefresher } from '@/components/live/LiveRefresher'

export const dynamic = 'force-dynamic'

export default async function AdminProductsPage() {
  const [products, categories] = await Promise.all([listAllProducts(), listProductCategories()])
  const categoryEmojis = Object.fromEntries(
    categories.filter((c) => c.emoji).map((c) => [c.name, c.emoji as string])
  )
  const categoryOrder = categories.map((c) => ({ id: c.id, name: c.name }))

  return (
    <div className="space-y-4 px-4 md:px-0">
      <LiveRefresher tables={['products', 'product_categories']} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Produits (POS)</h1>
        <Button asChild>
          <Link href="/admin/products/new">Nouveau produit</Link>
        </Button>
      </div>

      <ProductsTable products={products} categoryEmojis={categoryEmojis} categoryOrder={categoryOrder} />
    </div>
  )
}
