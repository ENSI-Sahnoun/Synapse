import { createSupabaseClient } from '@/supabase-clients/server'
import { CASH_DISCREPANCY_CATEGORY_ID } from '@/lib/accounting-constants'
import { enumerateDays, roundDt, tunisDate, tunisRange } from '@/lib/tz'

export type ExpenseRow = {
  id: string
  description: string
  amount_dt: number
  date: string
  created_at: string
  account_category: { id: string; name: string }
}

export type PnlRow = {
  category_id: string
  category_name: string
  type: 'income' | 'expense'
  total: number
}

export type PnlSummary = {
  rows: PnlRow[]
  totalRevenue: number
  totalExpenses: number
  profit: number
}

export type AccountCategory = {
  id: string
  type: 'income' | 'expense'
  name: string
  description: string | null
  is_active: boolean
}

/** Day a timestamptz falls on for the business (Africa/Tunis), not UTC. */
function businessDay(timestamptz: string): string {
  return tunisDate(new Date(timestamptz))
}

export async function getExpenses(filters: {
  from?: string
  to?: string
  category_id?: string
}): Promise<ExpenseRow[]> {
  const supabase = await createSupabaseClient()

  let query = supabase
    .from('expenses')
    .select(
      `id, description, amount_dt, date, created_at,
       account_category:account_categories!inner(id, name)`,
    )
    .order('date', { ascending: false })

  // `expenses.date` is a plain date column, so it needs no timezone treatment.
  if (filters.from) query = query.gte('date', filters.from)
  if (filters.to) query = query.lte('date', filters.to)
  if (filters.category_id) query = query.eq('account_category_id', filters.category_id)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map((r) => ({
    ...r,
    amount_dt: Number(r.amount_dt),
    account_category: r.account_category as { id: string; name: string },
  }))
}

type PurchaseLine = {
  quantity: number
  unit_price_dt: number
  purchases: { id: string; created_at: string; discount_dt: number }
  products: {
    account_category_id: string
    cost_price: number | null
    account_categories: { id: string; name: string }
  }
}

/**
 * POS line revenue net of the header discount, allocated pro-rata.
 *
 * `pos_checkout` records the cashier discount on `purchases.discount_dt` and
 * leaves line items at full price. Summing lines therefore reports revenue the
 * business never collected. A 10 DT discount on a 100 DT basket takes 10% off
 * every line so each product category carries its share.
 */
function allocateDiscounts(lines: PurchaseLine[]): Map<PurchaseLine, number> {
  const grossByPurchase = new Map<string, number>()
  for (const l of lines) {
    const id = l.purchases.id
    grossByPurchase.set(id, (grossByPurchase.get(id) ?? 0) + l.quantity * l.unit_price_dt)
  }

  const net = new Map<PurchaseLine, number>()
  for (const l of lines) {
    const gross = grossByPurchase.get(l.purchases.id) ?? 0
    const factor = gross > 0 ? 1 - Number(l.purchases.discount_dt) / gross : 1
    net.set(l, l.quantity * l.unit_price_dt * factor)
  }
  return net
}

export async function getPnl(filters: { from: string; to: string }): Promise<PnlSummary> {
  const supabase = await createSupabaseClient()
  const { start, endExclusive } = tunisRange(filters.from, filters.to)

  const { data: settingRow } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'subscription_income_category_id')
    .single()

  const subCategoryId = settingRow?.value as string | undefined

  const { data: subCategoryRow } = subCategoryId
    ? await supabase.from('account_categories').select('id, name').eq('id', subCategoryId).single()
    : { data: null }

  const [{ data: subs }, { data: lockerPayments }, { data: purchaseItems }, { data: expenses }] =
    await Promise.all([
      supabase.from('subscriptions').select('paid_amount').gte('created_at', start).lt('created_at', endExclusive),
      supabase.from('locker_payments').select('amount_dt').gte('created_at', start).lt('created_at', endExclusive),
      // Filtered on the PURCHASE's timestamp, not the line's. They are written in
      // the same transaction so they agree today, but the purchase header is the
      // authoritative sale time and is what every other query filters on.
      supabase
        .from('purchase_items')
        .select(
          `quantity, unit_price_dt,
           purchases!inner(id, created_at, discount_dt),
           products!inner(account_category_id, cost_price,
             account_categories!inner(id, name))`,
        )
        .gte('purchases.created_at', start)
        .lt('purchases.created_at', endExclusive),
      supabase
        .from('expenses')
        .select('amount_dt, account_category_id, account_categories!inner(id, name)')
        .gte('date', filters.from)
        .lte('date', filters.to),
    ])

  const subsTotal = subs?.reduce((s, r) => s + Number(r.paid_amount), 0) ?? 0
  const lockersTotal = lockerPayments?.reduce((s, r) => s + Number(r.amount_dt), 0) ?? 0

  const lines = (purchaseItems ?? []).map((pi) => ({
    quantity: Number(pi.quantity),
    unit_price_dt: Number(pi.unit_price_dt),
    purchases: pi.purchases as unknown as PurchaseLine['purchases'],
    products: pi.products as unknown as PurchaseLine['products'],
  }))
  const netByLine = allocateDiscounts(lines)

  const purchaseMap = new Map<string, { name: string; total: number }>()
  let cogsTotal = 0
  for (const line of lines) {
    const catId = line.products.account_category_id
    const catName = line.products.account_categories.name
    const existing = purchaseMap.get(catId)
    const amount = netByLine.get(line) ?? 0
    if (existing) existing.total += amount
    else purchaseMap.set(catId, { name: catName, total: amount })

    cogsTotal += line.quantity * Number(line.products.cost_price ?? 0)
  }

  const expenseMap = new Map<string, { name: string; total: number }>()
  expenses?.forEach((e) => {
    const cat = e.account_categories as unknown as { id: string; name: string }
    const existing = expenseMap.get(e.account_category_id)
    if (existing) existing.total += Number(e.amount_dt)
    else expenseMap.set(e.account_category_id, { name: cat.name, total: Number(e.amount_dt) })
  })

  const rows: PnlRow[] = []

  if (subCategoryRow && subsTotal > 0) {
    rows.push({
      category_id: subCategoryRow.id,
      category_name: subCategoryRow.name,
      type: 'income',
      total: roundDt(subsTotal),
    })
  }

  purchaseMap.forEach((v, catId) => {
    rows.push({ category_id: catId, category_name: v.name, type: 'income', total: roundDt(v.total) })
  })

  if (lockersTotal > 0) {
    rows.push({ category_id: 'lockers', category_name: 'Casiers', type: 'income', total: roundDt(lockersTotal) })
  }

  // Cost of goods sold belongs on the statement as an expense line. Without it
  // this table's bottom line disagreed with the net-profit card rendered
  // directly above it on the same tab — two bold, contradictory "résultat net"
  // figures, differing by the entire cost of every product sold.
  if (cogsTotal > 0) {
    rows.push({
      category_id: 'cogs',
      category_name: 'Coût des marchandises vendues',
      type: 'expense',
      total: roundDt(cogsTotal),
    })
  }

  expenseMap.forEach((v, catId) => {
    rows.push({ category_id: catId, category_name: v.name, type: 'expense', total: roundDt(v.total) })
  })

  const totalRevenue = roundDt(rows.filter((r) => r.type === 'income').reduce((s, r) => s + r.total, 0))
  const totalExpenses = roundDt(rows.filter((r) => r.type === 'expense').reduce((s, r) => s + r.total, 0))

  return { rows, totalRevenue, totalExpenses, profit: roundDt(totalRevenue - totalExpenses) }
}

export type TransactionRow = {
  date: string
  description: string
  type: 'income' | 'expense'
  amount: number
}

export async function getTransactions(filters: { from: string; to: string }): Promise<TransactionRow[]> {
  const supabase = await createSupabaseClient()
  const { start, endExclusive } = tunisRange(filters.from, filters.to)

  const [{ data: subs }, { data: purchases }, { data: expenses }, { data: lockerPayments }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('paid_amount, created_at, subscription_plans(name)')
      .gte('created_at', start)
      .lt('created_at', endExclusive),
    supabase
      .from('purchases')
      .select('total_dt, discount_dt, created_at')
      .gte('created_at', start)
      .lt('created_at', endExclusive),
    supabase
      .from('expenses')
      .select('amount_dt, date, description, account_categories!inner(name)')
      .gte('date', filters.from)
      .lte('date', filters.to),
    supabase
      .from('locker_payments')
      .select('amount_dt, created_at, lockers(number)')
      .gte('created_at', start)
      .lt('created_at', endExclusive),
  ])

  const rows: TransactionRow[] = []

  subs?.forEach((r) => {
    const plan = r.subscription_plans as unknown as { name: string } | null
    rows.push({
      date: r.created_at,
      description: `Abonnement — ${plan?.name ?? 'N/A'}`,
      type: 'income',
      amount: Number(r.paid_amount),
    })
  })

  purchases?.forEach((r) => {
    const discount = Number(r.discount_dt)
    rows.push({
      date: r.created_at,
      description: discount > 0 ? `Vente comptoir (remise ${discount.toFixed(3)} DT)` : 'Vente comptoir',
      type: 'income',
      amount: Number(r.total_dt),
    })
  })

  lockerPayments?.forEach((r) => {
    const locker = r.lockers as unknown as { number: number } | null
    rows.push({
      date: r.created_at,
      description: `Casier${locker ? ` n°${locker.number}` : ''}`,
      type: 'income',
      amount: Number(r.amount_dt),
    })
  })

  expenses?.forEach((r) => {
    const cat = r.account_categories as unknown as { name: string }
    rows.push({
      date: r.date,
      description: `${cat.name} — ${r.description}`,
      type: 'expense',
      amount: Number(r.amount_dt),
    })
  })

  return rows.sort((a, b) => a.date.localeCompare(b.date))
}

export async function getExpenseCategories(): Promise<AccountCategory[]> {
  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('account_categories')
    .select('*')
    .eq('type', 'expense')
    .eq('is_active', true)
    .order('name')
  return (data ?? []) as AccountCategory[]
}

export type FinanceSummary = {
  revenue: number
  subsRevenue: number
  posRevenue: number
  lockerRevenue: number
  discounts: number
  cogs: number
  missingCostProducts: number
  expenses: number
  grossMargin: number
  netProfit: number
  prevNetProfit: number
  netProfitDelta: number
  // Ratios. Absolute dinar deltas cannot answer "did the business get more
  // efficient" — revenue can grow 20% while margin compresses, and that shows
  // up as a green arrow. Margin sliding 42% → 31% over six months was
  // invisible in this UI until absolute profit finally went negative.
  grossMarginPct: number
  netMarginPct: number
  prevNetMarginPct: number
  netProfitDeltaPct: number | null
  revenueDeltaPct: number | null
}

/** Percentage change, or null when there is no baseline to divide by. */
export function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

function lastDayOfMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate()
}

/**
 * The comparison window for every delta on the dashboard and accounting page.
 *
 * A fixed day-count shift is wrong for the default `this_month` range: on 20
 * March it compared 1–20 March against 9–28 February, a window straddling two
 * months that the owner cannot name. When the range starts on the 1st it is a
 * calendar month (or month-to-date), so the baseline is the same slice of the
 * previous calendar month. Everything else keeps the same-length-window
 * behaviour.
 */
export function previousPeriod(from: string, to: string): { from: string; to: string } {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)

  const startsOnFirst = fd === 1
  const sameMonth = fy === ty && fm === tm

  if (startsOnFirst && sameMonth) {
    const prevMonth = fm === 1 ? 12 : fm - 1
    const prevYear = fm === 1 ? fy - 1 : fy
    const prevLen = lastDayOfMonth(prevYear, prevMonth)
    const isFullMonth = td === lastDayOfMonth(ty, tm)
    // Month-to-date compares against the same day-of-month; a full month
    // compares against the whole previous month. Clamp so 31 March → 28/29 Feb.
    const prevTo = isFullMonth ? prevLen : Math.min(td, prevLen)
    const pad = (n: number) => String(n).padStart(2, '0')
    return {
      from: `${prevYear}-${pad(prevMonth)}-01`,
      to: `${prevYear}-${pad(prevMonth)}-${pad(prevTo)}`,
    }
  }

  const fromDate = new Date(from + 'T00:00:00Z')
  const toDate = new Date(to + 'T00:00:00Z')
  const days = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1
  const prevTo = new Date(fromDate.getTime() - 86_400_000)
  const prevFrom = new Date(prevTo.getTime() - (days - 1) * 86_400_000)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { from: fmt(prevFrom), to: fmt(prevTo) }
}

async function computeNetProfit(
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  from: string,
  to: string,
) {
  const { start, endExclusive } = tunisRange(from, to)

  const [{ data: cogsRows }, { data: subs }, { data: expenses }, { data: lockerPayments }] = await Promise.all([
    supabase.rpc('analytics_cogs', { p_from: from, p_to: to }),
    supabase.from('subscriptions').select('paid_amount').gte('created_at', start).lt('created_at', endExclusive),
    supabase.from('expenses').select('amount_dt').gte('date', from).lte('date', to),
    supabase.from('locker_payments').select('amount_dt').gte('created_at', start).lt('created_at', endExclusive),
  ])

  const cogsRow = cogsRows?.[0] ?? { cogs: 0, revenue: 0, discounts: 0, missing_cost_products: 0 }
  const subsRevenue = subs?.reduce((s, r) => s + Number(r.paid_amount), 0) ?? 0
  // Net of discount as of 20260720000000 — the RPC now sources this from
  // `purchases.total_dt` rather than summing full-price line items.
  const posRevenue = Number(cogsRow.revenue)
  const lockerRevenue = lockerPayments?.reduce((s, r) => s + Number(r.amount_dt), 0) ?? 0
  const cogs = Number(cogsRow.cogs)
  const expensesTotal = expenses?.reduce((s, r) => s + Number(r.amount_dt), 0) ?? 0
  const revenue = subsRevenue + posRevenue + lockerRevenue
  const grossMargin = revenue - cogs
  const netProfit = grossMargin - expensesTotal

  return {
    revenue: roundDt(revenue),
    netProfit: roundDt(netProfit),
    subsRevenue: roundDt(subsRevenue),
    posRevenue: roundDt(posRevenue),
    lockerRevenue: roundDt(lockerRevenue),
    discounts: roundDt(Number(cogsRow.discounts ?? 0)),
    cogs: roundDt(cogs),
    missingCostProducts: Number(cogsRow.missing_cost_products),
    expenses: roundDt(expensesTotal),
    grossMargin: roundDt(grossMargin),
  }
}

export async function getFinanceSummary(filters: { from: string; to: string }): Promise<FinanceSummary> {
  const supabase = await createSupabaseClient()
  const prev = previousPeriod(filters.from, filters.to)

  const [current, previous] = await Promise.all([
    computeNetProfit(supabase, filters.from, filters.to),
    computeNetProfit(supabase, prev.from, prev.to),
  ])

  const pct = (part: number, whole: number) => (whole > 0 ? roundDt((part / whole) * 100) : 0)

  return {
    revenue: current.revenue,
    subsRevenue: current.subsRevenue,
    posRevenue: current.posRevenue,
    lockerRevenue: current.lockerRevenue,
    discounts: current.discounts,
    cogs: current.cogs,
    missingCostProducts: current.missingCostProducts,
    expenses: current.expenses,
    grossMargin: current.grossMargin,
    netProfit: current.netProfit,
    prevNetProfit: previous.netProfit,
    netProfitDelta: roundDt(current.netProfit - previous.netProfit),
    grossMarginPct: pct(current.grossMargin, current.revenue),
    netMarginPct: pct(current.netProfit, current.revenue),
    prevNetMarginPct: pct(previous.netProfit, previous.revenue),
    netProfitDeltaPct: pctDelta(current.netProfit, previous.netProfit),
    revenueDeltaPct: pctDelta(current.revenue, previous.revenue),
  }
}

export type RevenueSplitPoint = { date: string; subs: number; pos: number; lockers: number }
export type ExpenseByCategory = { category: string; total: number; isSystem: boolean }
export type CashFlowPoint = { date: string; net: number; cumulative: number }

export async function getRevenueSplit(filters: { from: string; to: string }): Promise<RevenueSplitPoint[]> {
  const supabase = await createSupabaseClient()
  const { start, endExclusive } = tunisRange(filters.from, filters.to)

  const [{ data: subs }, { data: purchases }, { data: lockerPayments }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('paid_amount, created_at')
      .gte('created_at', start)
      .lt('created_at', endExclusive),
    supabase.from('purchases').select('total_dt, created_at').gte('created_at', start).lt('created_at', endExclusive),
    supabase
      .from('locker_payments')
      .select('amount_dt, created_at')
      .gte('created_at', start)
      .lt('created_at', endExclusive),
  ])

  const subsMap = new Map<string, number>()
  subs?.forEach((r) => {
    const d = businessDay(r.created_at)
    subsMap.set(d, (subsMap.get(d) ?? 0) + Number(r.paid_amount))
  })

  const posMap = new Map<string, number>()
  purchases?.forEach((r) => {
    const d = businessDay(r.created_at)
    posMap.set(d, (posMap.get(d) ?? 0) + Number(r.total_dt))
  })

  const lockersMap = new Map<string, number>()
  lockerPayments?.forEach((r) => {
    const d = businessDay(r.created_at)
    lockersMap.set(d, (lockersMap.get(d) ?? 0) + Number(r.amount_dt))
  })

  return enumerateDays(filters.from, filters.to).map((date) => ({
    date,
    subs: roundDt(subsMap.get(date) ?? 0),
    pos: roundDt(posMap.get(date) ?? 0),
    lockers: roundDt(lockersMap.get(date) ?? 0),
  }))
}

export async function getExpensesByCategory(filters: { from: string; to: string }): Promise<ExpenseByCategory[]> {
  const supabase = await createSupabaseClient()

  const { data } = await supabase
    .from('expenses')
    .select('amount_dt, account_category_id, account_categories!inner(name)')
    .gte('date', filters.from)
    .lte('date', filters.to)

  // Écart de caisse used to be dropped here — matched on its French display
  // name, so renaming the category silently reinstated it — while still being
  // counted in every expense total. The chart therefore never summed to the
  // figure printed beside it. Now that cash sessions reconcile against all
  // revenue streams a discrepancy is a real signal, so it is shown, flagged as
  // system-generated rather than hidden.
  const map = new Map<string, { total: number; isSystem: boolean }>()
  data?.forEach((r) => {
    const cat = r.account_categories as unknown as { name: string }
    const isSystem = r.account_category_id === CASH_DISCREPANCY_CATEGORY_ID
    const existing = map.get(cat.name)
    if (existing) existing.total += Number(r.amount_dt)
    else map.set(cat.name, { total: Number(r.amount_dt), isSystem })
  })

  return Array.from(map.entries())
    .map(([category, v]) => ({ category, total: roundDt(v.total), isSystem: v.isSystem }))
    .sort((a, b) => b.total - a.total)
}

export async function getCashFlow(filters: { from: string; to: string }): Promise<CashFlowPoint[]> {
  const supabase = await createSupabaseClient()
  const { start, endExclusive } = tunisRange(filters.from, filters.to)

  const [{ data: subs }, { data: purchases }, { data: expenses }, { data: lockerPayments }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('paid_amount, created_at')
      .gte('created_at', start)
      .lt('created_at', endExclusive),
    supabase.from('purchases').select('total_dt, created_at').gte('created_at', start).lt('created_at', endExclusive),
    supabase.from('expenses').select('amount_dt, date').gte('date', filters.from).lte('date', filters.to),
    supabase
      .from('locker_payments')
      .select('amount_dt, created_at')
      .gte('created_at', start)
      .lt('created_at', endExclusive),
  ])

  const map = new Map<string, number>()
  subs?.forEach((r) => {
    const d = businessDay(r.created_at)
    map.set(d, (map.get(d) ?? 0) + Number(r.paid_amount))
  })
  purchases?.forEach((r) => {
    const d = businessDay(r.created_at)
    map.set(d, (map.get(d) ?? 0) + Number(r.total_dt))
  })
  lockerPayments?.forEach((r) => {
    const d = businessDay(r.created_at)
    map.set(d, (map.get(d) ?? 0) + Number(r.amount_dt))
  })
  expenses?.forEach((r) => {
    const d = r.date.slice(0, 10)
    map.set(d, (map.get(d) ?? 0) - Number(r.amount_dt))
  })

  // A running total alongside the daily bars: the daily series answers "was
  // yesterday good", the cumulative line answers "are we ahead this period",
  // which is the question a cash-flow chart is actually for.
  let running = 0
  return enumerateDays(filters.from, filters.to).map((date) => {
    const net = roundDt(map.get(date) ?? 0)
    running = roundDt(running + net)
    return { date, net, cumulative: running }
  })
}
