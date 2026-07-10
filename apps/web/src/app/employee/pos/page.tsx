import { listActiveProducts } from '@/data/employee/products'
import { listProductCategories } from '@/data/admin/product-categories'
import { getLoggedInUserProfile } from '@/data/user/user'
import { getOpenCashSession } from '@/data/employee/cash-sessions'
import { LiveRefresher } from '@/components/live/LiveRefresher'
import { PosClient } from './pos-client'
import { OpenSessionForm } from './open-session-form'

export default async function PosPage() {
  const [products, categories, profile, cashSession] = await Promise.all([
    listActiveProducts(),
    listProductCategories(),
    getLoggedInUserProfile(),
    getOpenCashSession(),
  ])
  const categoryEmojis = Object.fromEntries(
    categories.filter((c) => c.emoji).map((c) => [c.name, c.emoji as string])
  )
  const categoryOrder = categories.map((c) => c.name)

  // Mandatory open: no open cash session -> gate the whole POS behind the
  // "Ouverture de caisse" form instead of rendering PosClient.
  if (!cashSession) {
    return (
      <>
        <LiveRefresher tables={['cash_register_sessions', 'cash_movements']} />
        <OpenSessionForm />
      </>
    )
  }

  return (
    <>
      <LiveRefresher tables={['products', 'product_categories', 'cash_register_sessions', 'cash_movements']} />
      <PosClient
        products={products}
        categoryEmojis={categoryEmojis}
        categoryOrder={categoryOrder}
        currentUser={{ id: profile.id, fullName: profile.full_name }}
        cashSession={cashSession}
      />
    </>
  )
}
