import { listActiveProducts } from '@/data/employee/products'
import { listProductCategories } from '@/data/admin/product-categories'
import { listChargeablePeople } from '@/data/admin/chargeable-people'
import { getLoggedInUserProfile } from '@/data/user/user'
import { getOpenCashSession } from '@/data/employee/cash-sessions'
import { LiveRefresher } from '@/components/live/LiveRefresher'
import { PosClient } from './pos-client'

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
  const isAdmin = profile.role === 'admin'
  const chargeablePeople = isAdmin ? await listChargeablePeople() : []

  // cashSession may be null (no open session) — PosClient itself decides
  // whether to show the "Ouverture de caisse" form or the POS UI. Keeping a
  // single, always-mounted PosClient (instead of swapping it for
  // OpenSessionForm here) means a live-refresh right after closing a session
  // doesn't unmount PosClient and wipe its "just closed" summary state.
  return (
    <>
      <LiveRefresher tables={['products', 'product_categories', 'cash_register_sessions', 'cash_movements']} />
      <PosClient
        products={products}
        categoryEmojis={categoryEmojis}
        categoryOrder={categoryOrder}
        currentUser={{ id: profile.id, fullName: profile.full_name }}
        cashSession={cashSession}
        isAdmin={isAdmin}
        chargeablePeople={chargeablePeople}
      />
    </>
  )
}
