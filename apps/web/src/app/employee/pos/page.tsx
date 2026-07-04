import { listActiveProducts } from '@/data/employee/products'
import { listProductCategories } from '@/data/admin/product-categories'
import { PosClient } from './pos-client'

export default async function PosPage() {
  const [products, categories] = await Promise.all([listActiveProducts(), listProductCategories()])
  const categoryEmojis = Object.fromEntries(
    categories.filter((c) => c.emoji).map((c) => [c.name, c.emoji as string])
  )
  const categoryOrder = categories.map((c) => c.name)
  return <PosClient products={products} categoryEmojis={categoryEmojis} categoryOrder={categoryOrder} />
}
