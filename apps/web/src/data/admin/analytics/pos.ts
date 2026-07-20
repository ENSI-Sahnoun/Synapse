import { createSupabaseClient } from '@/supabase-clients/server'
import { roundDt, tunisRange } from '@/lib/tz'

export type CogsSummary = { cogs: number; revenue: number; discounts: number; missingCostProducts: number }
export type ProductMargin = {
  productId: string
  productName: string
  quantitySold: number
  revenue: number
  cogs: number
  margin: number
  costMissing: boolean
}

export async function getCogs(range: { from: string; to: string }): Promise<CogsSummary> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .rpc('analytics_cogs', { p_from: range.from, p_to: range.to })
    .single()
  if (error) throw new Error(error.message)

  return {
    cogs: Number(data.cogs),
    revenue: Number(data.revenue),
    discounts: Number(data.discounts ?? 0),
    missingCostProducts: data.missing_cost_products,
  }
}

export async function getProductMargin(range: { from: string; to: string }): Promise<ProductMargin[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.rpc('analytics_product_margin', {
    p_from: range.from,
    p_to: range.to,
  })
  if (error) throw new Error(error.message)

  return (data ?? []).map((r) => ({
    productId: r.product_id,
    productName: r.product_name,
    quantitySold: Number(r.quantity_sold),
    revenue: Number(r.revenue),
    cogs: Number(r.cogs),
    margin: Number(r.margin),
    costMissing: r.cost_missing,
  }))
}

export type BestSeller = { productId: string; productName: string; quantitySold: number; revenue: number }
export type CategorySales = { category: string; revenue: number }
export type RestockEvent = { id: string; productName: string; quantity: number; actorId: string; createdAt: string }

export function rankBestSellers(rows: BestSeller[], limit = 10): BestSeller[] {
  return [...rows].sort((a, b) => b.quantitySold - a.quantitySold).slice(0, limit)
}

export async function getBestSellers(
  range: { from: string; to: string },
  limit = 10,
): Promise<BestSeller[]> {
  const supabase = await createSupabaseClient()
  const { start, endExclusive } = tunisRange(range.from, range.to)

  // Scoped by the PURCHASE timestamp, and revenue reported net of the header
  // discount so a best-seller's revenue reconciles with the P&L instead of
  // overstating by every comp the cashier gave away.
  const { data } = await supabase
    .from('purchase_items')
    .select('quantity, unit_price_dt, purchases!inner(id, created_at, discount_dt), products!inner(id, name)')
    .gte('purchases.created_at', start)
    .lt('purchases.created_at', endExclusive)

  const rows = (data ?? []).map((r) => ({
    quantity: Number(r.quantity),
    unit_price_dt: Number(r.unit_price_dt),
    purchase: r.purchases as unknown as { id: string; discount_dt: number },
    product: r.products as unknown as { id: string; name: string },
  }))

  const grossByPurchase = new Map<string, number>()
  for (const r of rows) {
    grossByPurchase.set(
      r.purchase.id,
      (grossByPurchase.get(r.purchase.id) ?? 0) + r.quantity * r.unit_price_dt,
    )
  }

  const map = new Map<string, BestSeller>()
  for (const r of rows) {
    const existing = map.get(r.product.id) ?? {
      productId: r.product.id,
      productName: r.product.name,
      quantitySold: 0,
      revenue: 0,
    }
    const gross = grossByPurchase.get(r.purchase.id) ?? 0
    const factor = gross > 0 ? 1 - Number(r.purchase.discount_dt) / gross : 1
    existing.quantitySold += r.quantity
    existing.revenue = roundDt(existing.revenue + r.quantity * r.unit_price_dt * factor)
    map.set(r.product.id, existing)
  }

  return rankBestSellers(Array.from(map.values()), limit)
}

export async function getSalesByCategory(range: { from: string; to: string }): Promise<CategorySales[]> {
  const supabase = await createSupabaseClient()
  const { start, endExclusive } = tunisRange(range.from, range.to)

  const { data } = await supabase
    .from('purchase_items')
    .select('quantity, unit_price_dt, purchases!inner(id, created_at, discount_dt), products!inner(category)')
    .gte('purchases.created_at', start)
    .lt('purchases.created_at', endExclusive)

  const rows = (data ?? []).map((r) => ({
    quantity: Number(r.quantity),
    unit_price_dt: Number(r.unit_price_dt),
    purchase: r.purchases as unknown as { id: string; discount_dt: number },
    category: (r.products as unknown as { category: string }).category,
  }))

  const grossByPurchase = new Map<string, number>()
  for (const r of rows) {
    grossByPurchase.set(
      r.purchase.id,
      (grossByPurchase.get(r.purchase.id) ?? 0) + r.quantity * r.unit_price_dt,
    )
  }

  const map = new Map<string, number>()
  for (const r of rows) {
    const gross = grossByPurchase.get(r.purchase.id) ?? 0
    const factor = gross > 0 ? 1 - Number(r.purchase.discount_dt) / gross : 1
    map.set(r.category, (map.get(r.category) ?? 0) + r.quantity * r.unit_price_dt * factor)
  }

  return Array.from(map.entries())
    .map(([category, revenue]) => ({ category, revenue: roundDt(revenue) }))
    .sort((a, b) => b.revenue - a.revenue)
}

export async function getRestockHistory(range: { from: string; to: string }): Promise<RestockEvent[]> {
  const supabase = await createSupabaseClient()
  const { start, endExclusive } = tunisRange(range.from, range.to)
  const { data } = await supabase
    .from('pos_activity_log')
    .select('id, quantity, actor_id, created_at, products(name)')
    .eq('action', 'restock')
    .gte('created_at', start)
    .lt('created_at', endExclusive)
    .order('created_at', { ascending: false })

  return (data ?? []).map((r) => ({
    id: r.id,
    productName: (r.products as unknown as { name: string } | null)?.name ?? 'Produit supprimé',
    quantity: Number(r.quantity ?? 0),
    actorId: r.actor_id,
    createdAt: r.created_at,
  }))
}

export type StockSnapshotRow = {
  id: string
  name: string
  category: string
  startStock: number
  endStock: number
  delta: number
}

// Reconstructs each product's stock at the start and end of the period by
// rewinding movements from the current stock:
//   stock_at(T) = current − restocks_after(T) + sales_after(T) + charges_after(T)
// startStock = stock just before the period (rewind everything from `from` onward)
// endStock   = stock at the end of `to`
//
// Three movement types decrement or increment stock: POS sales, restocks, and
// employee charges (20260712000000_pos_employee_charge.sql, which does
// `stock_quantity = stock_quantity - v_quantity` and logs action
// 'employee_charge'). Charges were previously omitted from the rewind, so
// opening stock was understated by everything staff had consumed — cumulative
// over the period, and worst on exactly the products an owner audits for
// shrinkage. Manual stock edits through the product form remain untracked;
// they are the only remaining source of drift.
export async function getStockOverPeriod(range: { from: string; to: string }): Promise<StockSnapshotRow[]> {
  const supabase = await createSupabaseClient()
  const { start: periodStart, endExclusive: periodEnd } = tunisRange(range.from, range.to)

  // Fetch every movement from the start of the period onward; movements at or
  // after `periodEnd` are the subset used for the end-of-period figure.
  const [{ data: products }, { data: sales }, { data: restocks }, { data: charges }] = await Promise.all([
    supabase.from('products').select('id, name, category, stock_quantity, cost_price').eq('is_active', true),
    // Voided purchases restore stock immediately (pos_void_purchase) and that
    // restoration is already baked into the current stock_quantity read above,
    // but the purchase_items rows survive the soft delete. Without this filter
    // a voided sale's units get added back to the rewind a second time.
    supabase
      .from('purchase_items')
      .select('product_id, quantity, created_at, purchases!inner(voided_at)')
      .gte('created_at', periodStart)
      .is('purchases.voided_at', null),
    supabase
      .from('pos_activity_log')
      .select('product_id, quantity, created_at')
      .eq('action', 'restock')
      .gte('created_at', periodStart),
    supabase
      .from('pos_activity_log')
      .select('product_id, quantity, created_at')
      .eq('action', 'employee_charge')
      .gte('created_at', periodStart),
  ])

  // Accumulate per product: movements within the whole window (>= from) and the
  // tail at/after `periodEnd`.
  const tally = (rows: Array<{ product_id: string | null; quantity: number | null; created_at: string }> | null) => {
    const fromStart = new Map<string, number>()
    const afterTo = new Map<string, number>()
    for (const r of rows ?? []) {
      if (!r.product_id) continue
      const q = Number(r.quantity ?? 0)
      fromStart.set(r.product_id, (fromStart.get(r.product_id) ?? 0) + q)
      if (r.created_at >= periodEnd) afterTo.set(r.product_id, (afterTo.get(r.product_id) ?? 0) + q)
    }
    return { fromStart, afterTo }
  }

  const salesT = tally(sales as never)
  const restocksT = tally(restocks as never)
  const chargesT = tally(charges as never)

  return (products ?? [])
    .map((p) => {
      const startStock =
        p.stock_quantity -
        (restocksT.fromStart.get(p.id) ?? 0) +
        (salesT.fromStart.get(p.id) ?? 0) +
        (chargesT.fromStart.get(p.id) ?? 0)
      const endStock =
        p.stock_quantity -
        (restocksT.afterTo.get(p.id) ?? 0) +
        (salesT.afterTo.get(p.id) ?? 0) +
        (chargesT.afterTo.get(p.id) ?? 0)
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        startStock,
        endStock,
        delta: endStock - startStock,
      }
    })
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
}
