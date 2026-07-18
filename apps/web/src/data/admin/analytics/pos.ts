import { createSupabaseClient } from '@/supabase-clients/server'

export type CogsSummary = { cogs: number; revenue: number; missingCostProducts: number }
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
  const { data } = await supabase
    .from('purchase_items')
    .select('quantity, unit_price_dt, created_at, products!inner(id, name), purchases!inner(voided_at)')
    .gte('created_at', range.from + 'T00:00:00')
    .lte('created_at', range.to + 'T23:59:59')
    .is('purchases.voided_at', null)

  const map = new Map<string, BestSeller>()
  data?.forEach((r) => {
    const product = r.products as unknown as { id: string; name: string }
    const existing = map.get(product.id) ?? {
      productId: product.id,
      productName: product.name,
      quantitySold: 0,
      revenue: 0,
    }
    existing.quantitySold += Number(r.quantity)
    existing.revenue += Number(r.quantity) * Number(r.unit_price_dt)
    map.set(product.id, existing)
  })

  return rankBestSellers(Array.from(map.values()), limit)
}

export async function getSalesByCategory(range: { from: string; to: string }): Promise<CategorySales[]> {
  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('purchase_items')
    .select('quantity, unit_price_dt, created_at, products!inner(category), purchases!inner(voided_at)')
    .gte('created_at', range.from + 'T00:00:00')
    .lte('created_at', range.to + 'T23:59:59')
    .is('purchases.voided_at', null)

  const map = new Map<string, number>()
  data?.forEach((r) => {
    const category = (r.products as unknown as { category: string }).category
    const amount = Number(r.quantity) * Number(r.unit_price_dt)
    map.set(category, (map.get(category) ?? 0) + amount)
  })

  return Array.from(map.entries())
    .map(([category, revenue]) => ({ category, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
}

export async function getRestockHistory(range: { from: string; to: string }): Promise<RestockEvent[]> {
  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('pos_activity_log')
    .select('id, quantity, actor_id, created_at, products(name)')
    .eq('action', 'restock')
    .gte('created_at', range.from + 'T00:00:00')
    .lte('created_at', range.to + 'T23:59:59')
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
//   stock_at(T) = current − restocks_after(T) + sales_after(T)
// startStock = stock just before the period (rewind everything from `from` onward)
// endStock   = stock at the end of `to`
// Note: manual stock edits via product update aren't tracked as movements, so
// the result is exact only for stock changed through sales and restocks.
export async function getStockOverPeriod(range: { from: string; to: string }): Promise<StockSnapshotRow[]> {
  const supabase = await createSupabaseClient()
  const periodStart = range.from + 'T00:00:00'
  const periodEnd = range.to + 'T23:59:59'

  // Fetch every movement from the start of the period onward; movements strictly
  // after `to` are the subset used for the end-of-period figure.
  const [{ data: products }, { data: sales }, { data: restocks }] = await Promise.all([
    supabase.from('products').select('id, name, category, stock_quantity').eq('is_active', true),
    supabase.from('purchase_items').select('product_id, quantity, created_at').gte('created_at', periodStart),
    supabase
      .from('pos_activity_log')
      .select('product_id, quantity, created_at')
      .eq('action', 'restock')
      .gte('created_at', periodStart),
  ])

  // Accumulate per product: movements within the whole window (>= from) and the
  // tail after `to`.
  const salesFrom = new Map<string, number>()
  const salesAfterTo = new Map<string, number>()
  for (const r of sales ?? []) {
    const q = Number(r.quantity)
    salesFrom.set(r.product_id, (salesFrom.get(r.product_id) ?? 0) + q)
    if (r.created_at > periodEnd) salesAfterTo.set(r.product_id, (salesAfterTo.get(r.product_id) ?? 0) + q)
  }
  const restocksFrom = new Map<string, number>()
  const restocksAfterTo = new Map<string, number>()
  for (const r of restocks ?? []) {
    if (!r.product_id) continue
    const q = Number(r.quantity ?? 0)
    restocksFrom.set(r.product_id, (restocksFrom.get(r.product_id) ?? 0) + q)
    if (r.created_at > periodEnd) restocksAfterTo.set(r.product_id, (restocksAfterTo.get(r.product_id) ?? 0) + q)
  }

  return (products ?? [])
    .map((p) => {
      const startStock = p.stock_quantity - (restocksFrom.get(p.id) ?? 0) + (salesFrom.get(p.id) ?? 0)
      const endStock = p.stock_quantity - (restocksAfterTo.get(p.id) ?? 0) + (salesAfterTo.get(p.id) ?? 0)
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
