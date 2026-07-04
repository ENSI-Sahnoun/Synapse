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
    .select('quantity, unit_price_dt, created_at, products!inner(id, name)')
    .gte('created_at', range.from + 'T00:00:00')
    .lte('created_at', range.to + 'T23:59:59')

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
    .select('quantity, unit_price_dt, created_at, products!inner(category)')
    .gte('created_at', range.from + 'T00:00:00')
    .lte('created_at', range.to + 'T23:59:59')

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

export async function getLowStockList(
  threshold = 5,
): Promise<Array<{ id: string; name: string; stock_quantity: number }>> {
  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('products')
    .select('id, name, stock_quantity')
    .eq('is_active', true)
    .lte('stock_quantity', threshold)
    .order('stock_quantity', { ascending: true })
  return data ?? []
}
