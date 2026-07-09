import { listActiveProducts } from '@/data/employee/products'
import { listProductCategories } from '@/data/admin/product-categories'
import { getLoggedInUserProfile } from '@/data/user/user'
import { LiveRefresher } from '@/components/live/LiveRefresher'
import { PosClient } from './pos-client'

export default async function PosPage() {
  const [products, categories, profile] = await Promise.all([
    listActiveProducts(),
    listProductCategories(),
    getLoggedInUserProfile(),
  ])
  const categoryEmojis = Object.fromEntries(
    categories.filter((c) => c.emoji).map((c) => [c.name, c.emoji as string])
  )
  const categoryOrder = categories.map((c) => c.name)
  return (
    <>
      <LiveRefresher tables={['products', 'product_categories']} />
      <PosClient
        products={products}
        categoryEmojis={categoryEmojis}
        categoryOrder={categoryOrder}
        currentUser={{ id: profile.id, fullName: profile.full_name }}
      />
    </>
  )
}
