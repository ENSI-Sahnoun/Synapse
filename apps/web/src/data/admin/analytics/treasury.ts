import { createSupabaseClient } from '@/supabase-clients/server'
import { roundDt } from '@/lib/tz'

// Same local-cast approach as `recurring.ts`: these RPCs land in
// `database.types.ts` centrally, not from here.
type RpcClient = (fn: string, args?: Record<string, unknown>) => Promise<{
  data: unknown[] | null
  error: { message: string } | null
}>

async function callRpc<Row>(fn: string, args: Record<string, unknown> = {}): Promise<Row[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await (supabase.rpc as unknown as RpcClient)(fn, args)
  if (error) throw new Error(error.message)
  return (data ?? []) as Row[]
}

export type Runway = {
  avgMonthlyInflow: number
  avgMonthlyOutflow: number
  /** Positive means cash is leaving faster than it arrives. */
  netBurnDt: number
  /**
   * Null when the business is profitable — its runway is infinite, not zero.
   * The UI must render "—", never a negative or zero month count.
   */
  runwayMonths: number | null
}

type RunwayRow = {
  avg_monthly_inflow: string
  avg_monthly_outflow: string
  net_burn_dt: string
  runway_months: string | null
}

export async function getRunway(months = 3): Promise<Runway> {
  const rows = await callRpc<RunwayRow>('analytics_runway', { p_months: months })
  const r = rows[0]
  if (!r) {
    return { avgMonthlyInflow: 0, avgMonthlyOutflow: 0, netBurnDt: 0, runwayMonths: null }
  }

  return {
    avgMonthlyInflow: roundDt(Number(r.avg_monthly_inflow)),
    avgMonthlyOutflow: roundDt(Number(r.avg_monthly_outflow)),
    netBurnDt: roundDt(Number(r.net_burn_dt)),
    runwayMonths: r.runway_months === null ? null : Number(r.runway_months),
  }
}

export type Breakeven = {
  revenueDt: number
  /** COGS plus every expense in a `variable` cost-behaviour category. */
  variableCostDt: number
  fixedCostDt: number
  contributionMarginDt: number
  /** Null without revenue to divide by. */
  contributionMarginPct: number | null
  /** Null when the contribution margin is zero or negative: no revenue level breaks even. */
  breakevenRevenueDt: number | null
  /** Null whenever break-even revenue is undefined. */
  marginOfSafetyPct: number | null
}

type BreakevenRow = {
  revenue_dt: string
  variable_cost_dt: string
  fixed_cost_dt: string
  contribution_margin_dt: string
  contribution_margin_pct: string | null
  breakeven_revenue_dt: string | null
  margin_of_safety_pct: string | null
}

export async function getBreakeven(range: { from: string; to: string }): Promise<Breakeven> {
  const rows = await callRpc<BreakevenRow>('analytics_breakeven', {
    p_from: range.from,
    p_to: range.to,
  })
  const r = rows[0]
  if (!r) {
    return {
      revenueDt: 0,
      variableCostDt: 0,
      fixedCostDt: 0,
      contributionMarginDt: 0,
      contributionMarginPct: null,
      breakevenRevenueDt: null,
      marginOfSafetyPct: null,
    }
  }

  return {
    revenueDt: roundDt(Number(r.revenue_dt)),
    variableCostDt: roundDt(Number(r.variable_cost_dt)),
    fixedCostDt: roundDt(Number(r.fixed_cost_dt)),
    contributionMarginDt: roundDt(Number(r.contribution_margin_dt)),
    contributionMarginPct:
      r.contribution_margin_pct === null ? null : Number(r.contribution_margin_pct),
    breakevenRevenueDt:
      r.breakeven_revenue_dt === null ? null : roundDt(Number(r.breakeven_revenue_dt)),
    marginOfSafetyPct: r.margin_of_safety_pct === null ? null : Number(r.margin_of_safety_pct),
  }
}

export type InventoryValuation = {
  /** Stock on hand at cost — the asset figure the treasury was missing. */
  inventoryValueDt: number
  retailValueDt: number
  skuCount: number
  unitsOnHand: number
  /** Products with no `cost_price`, which understate `inventoryValueDt`. */
  missingCostCount: number
}

type InventoryValuationRow = {
  inventory_value_dt: string
  retail_value_dt: string
  sku_count: string
  units_on_hand: string
  missing_cost_count: string
}

export async function getInventoryValuation(): Promise<InventoryValuation> {
  const rows = await callRpc<InventoryValuationRow>('analytics_inventory_valuation')
  const r = rows[0]
  if (!r) {
    return {
      inventoryValueDt: 0,
      retailValueDt: 0,
      skuCount: 0,
      unitsOnHand: 0,
      missingCostCount: 0,
    }
  }

  return {
    inventoryValueDt: roundDt(Number(r.inventory_value_dt)),
    retailValueDt: roundDt(Number(r.retail_value_dt)),
    skuCount: Number(r.sku_count),
    unitsOnHand: Number(r.units_on_hand),
    missingCostCount: Number(r.missing_cost_count),
  }
}

export type DeadStockRow = {
  productId: string
  productName: string
  stockQuantity: number
  /** Capital sitting on the shelf, at cost. */
  tiedUpDt: number
  /** Null when the product has never sold. */
  lastSoldAt: string | null
}

type DeadStockSqlRow = {
  product_id: string
  product_name: string
  stock_quantity: number
  tied_up_dt: string
  last_sold_at: string | null
}

export async function getDeadStock(days = 60): Promise<DeadStockRow[]> {
  const rows = await callRpc<DeadStockSqlRow>('analytics_dead_stock', { p_days: days })

  return rows.map((r) => ({
    productId: r.product_id,
    productName: r.product_name,
    stockQuantity: Number(r.stock_quantity),
    tiedUpDt: roundDt(Number(r.tied_up_dt)),
    lastSoldAt: r.last_sold_at,
  }))
}

export type BasketMetrics = {
  transactions: number
  avgBasketDt: number
  avgItemsPerBasket: number
  discountTotalDt: number
  /** Discount as a share of what the baskets would have fetched at list price. */
  discountRatePct: number
  discountedBaskets: number
  /**
   * Share of member visits that also bought something. Null when there were no
   * visits in the window — undefined, not 0%.
   */
  attachRatePct: number | null
}

type BasketRow = {
  transactions: string
  avg_basket_dt: string
  avg_items_per_basket: string
  discount_total_dt: string
  discount_rate_pct: string
  discounted_baskets: string
  attach_rate_pct: string | null
}

export async function getBasketMetrics(range: { from: string; to: string }): Promise<BasketMetrics> {
  const rows = await callRpc<BasketRow>('analytics_basket', {
    p_from: range.from,
    p_to: range.to,
  })
  const r = rows[0]
  if (!r) {
    return {
      transactions: 0,
      avgBasketDt: 0,
      avgItemsPerBasket: 0,
      discountTotalDt: 0,
      discountRatePct: 0,
      discountedBaskets: 0,
      attachRatePct: null,
    }
  }

  return {
    transactions: Number(r.transactions),
    avgBasketDt: roundDt(Number(r.avg_basket_dt)),
    avgItemsPerBasket: Number(r.avg_items_per_basket),
    discountTotalDt: roundDt(Number(r.discount_total_dt)),
    discountRatePct: Number(r.discount_rate_pct),
    discountedBaskets: Number(r.discounted_baskets),
    attachRatePct: r.attach_rate_pct === null ? null : Number(r.attach_rate_pct),
  }
}
