import { createSupabaseClient } from '@/supabase-clients/server'

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

export async function getPnl(filters: { from: string; to: string }): Promise<PnlSummary> {
  const supabase = await createSupabaseClient()

  const { data: settingRow } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'subscription_income_category_id')
    .single()

  const subCategoryId = settingRow?.value as string | undefined

  const { data: subCategoryRow } = subCategoryId
    ? await supabase
        .from('account_categories')
        .select('id, name')
        .eq('id', subCategoryId)
        .single()
    : { data: null }

  const { data: subs } = await supabase
    .from('subscriptions')
    .select('paid_amount')
    .gte('created_at', filters.from + 'T00:00:00')
    .lte('created_at', filters.to + 'T23:59:59')

  const subsTotal = subs?.reduce((s, r) => s + Number(r.paid_amount), 0) ?? 0

  const { data: lockerPayments } = await supabase
    .from('locker_payments')
    .select('amount_dt')
    .gte('created_at', filters.from + 'T00:00:00')
    .lte('created_at', filters.to + 'T23:59:59')

  const lockersTotal = lockerPayments?.reduce((s, r) => s + Number(r.amount_dt), 0) ?? 0

  const { data: purchaseItems } = await supabase
    .from('purchase_items')
    .select(
      `quantity, unit_price_dt,
       products!inner(account_category_id,
         account_categories!inner(id, name))`,
    )
    .gte('created_at', filters.from + 'T00:00:00')
    .lte('created_at', filters.to + 'T23:59:59')

  const purchaseMap = new Map<string, { name: string; total: number }>()
  purchaseItems?.forEach((pi) => {
    const prod = pi.products as unknown as {
      account_category_id: string
      account_categories: { id: string; name: string }
    }
    const catId = prod.account_category_id
    const catName = prod.account_categories.name
    const amount = Number(pi.unit_price_dt) * Number(pi.quantity)
    const existing = purchaseMap.get(catId)
    if (existing) existing.total += amount
    else purchaseMap.set(catId, { name: catName, total: amount })
  })

  const { data: expenses } = await supabase
    .from('expenses')
    .select('amount_dt, account_category_id, account_categories!inner(id, name)')
    .gte('date', filters.from)
    .lte('date', filters.to)

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
      total: subsTotal,
    })
  }

  purchaseMap.forEach((v, catId) => {
    rows.push({ category_id: catId, category_name: v.name, type: 'income', total: v.total })
  })

  if (lockersTotal > 0) {
    rows.push({ category_id: 'lockers', category_name: 'Casiers', type: 'income', total: lockersTotal })
  }

  expenseMap.forEach((v, catId) => {
    rows.push({ category_id: catId, category_name: v.name, type: 'expense', total: v.total })
  })

  const totalRevenue = rows
    .filter((r) => r.type === 'income')
    .reduce((s, r) => s + r.total, 0)

  const totalExpenses = rows
    .filter((r) => r.type === 'expense')
    .reduce((s, r) => s + r.total, 0)

  return { rows, totalRevenue, totalExpenses, profit: totalRevenue - totalExpenses }
}

export type TransactionRow = {
  date: string
  description: string
  type: 'income' | 'expense'
  amount: number
}

export async function getTransactions(filters: { from: string; to: string }): Promise<TransactionRow[]> {
  const supabase = await createSupabaseClient()

  const [{ data: subs }, { data: purchases }, { data: expenses }, { data: lockerPayments }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('paid_amount, created_at, subscription_plans(name)')
      .gte('created_at', filters.from + 'T00:00:00')
      .lte('created_at', filters.to + 'T23:59:59'),
    supabase
      .from('purchases')
      .select('total_dt, created_at')
      .gte('created_at', filters.from + 'T00:00:00')
      .lte('created_at', filters.to + 'T23:59:59'),
    supabase
      .from('expenses')
      .select('amount_dt, date, description, account_categories!inner(name)')
      .gte('date', filters.from)
      .lte('date', filters.to),
    supabase
      .from('locker_payments')
      .select('amount_dt, created_at, lockers(number)')
      .gte('created_at', filters.from + 'T00:00:00')
      .lte('created_at', filters.to + 'T23:59:59'),
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
    rows.push({
      date: r.created_at,
      description: 'Vente comptoir',
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
  cogs: number
  missingCostProducts: number
  expenses: number
  grossMargin: number
  netProfit: number
  prevNetProfit: number
  netProfitDelta: number
}

export function previousPeriod(from: string, to: string): { from: string; to: string } {
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
  const [{ data: cogsRows }, { data: subs }, { data: expenses }, { data: lockerPayments }] = await Promise.all([
    supabase.rpc('analytics_cogs', { p_from: from, p_to: to }),
    supabase
      .from('subscriptions')
      .select('paid_amount')
      .gte('created_at', from + 'T00:00:00')
      .lte('created_at', to + 'T23:59:59'),
    supabase.from('expenses').select('amount_dt').gte('date', from).lte('date', to),
    supabase
      .from('locker_payments')
      .select('amount_dt')
      .gte('created_at', from + 'T00:00:00')
      .lte('created_at', to + 'T23:59:59'),
  ])

  const cogsRow = cogsRows?.[0] ?? { cogs: 0, revenue: 0, missing_cost_products: 0 }
  const subsRevenue = subs?.reduce((s, r) => s + Number(r.paid_amount), 0) ?? 0
  const posRevenue = Number(cogsRow.revenue)
  const lockerRevenue = lockerPayments?.reduce((s, r) => s + Number(r.amount_dt), 0) ?? 0
  const cogs = Number(cogsRow.cogs)
  const expensesTotal = expenses?.reduce((s, r) => s + Number(r.amount_dt), 0) ?? 0
  const grossMargin = subsRevenue + posRevenue + lockerRevenue - cogs
  const netProfit = grossMargin - expensesTotal

  return {
    netProfit,
    subsRevenue,
    posRevenue,
    lockerRevenue,
    cogs,
    missingCostProducts: Number(cogsRow.missing_cost_products),
    expenses: expensesTotal,
  }
}

export async function getFinanceSummary(filters: { from: string; to: string }): Promise<FinanceSummary> {
  const supabase = await createSupabaseClient()
  const prev = previousPeriod(filters.from, filters.to)

  const [current, previous] = await Promise.all([
    computeNetProfit(supabase, filters.from, filters.to),
    computeNetProfit(supabase, prev.from, prev.to),
  ])

  return {
    revenue: current.subsRevenue + current.posRevenue + current.lockerRevenue,
    subsRevenue: current.subsRevenue,
    posRevenue: current.posRevenue,
    lockerRevenue: current.lockerRevenue,
    cogs: current.cogs,
    missingCostProducts: current.missingCostProducts,
    expenses: current.expenses,
    grossMargin: current.subsRevenue + current.posRevenue + current.lockerRevenue - current.cogs,
    netProfit: current.netProfit,
    prevNetProfit: previous.netProfit,
    netProfitDelta: current.netProfit - previous.netProfit,
  }
}

export type RevenueSplitPoint = { date: string; subs: number; pos: number; lockers: number }
export type ExpenseByCategory = { category: string; total: number }
export type CashFlowPoint = { date: string; net: number }

function enumerateDays(from: string, to: string): string[] {
  const days: string[] = []
  const cur = new Date(from + 'T00:00:00Z')
  const end = new Date(to + 'T00:00:00Z')
  while (cur <= end) {
    days.push(cur.toISOString().slice(0, 10))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return days
}

export async function getRevenueSplit(filters: { from: string; to: string }): Promise<RevenueSplitPoint[]> {
  const supabase = await createSupabaseClient()

  const [{ data: subs }, { data: purchases }, { data: lockerPayments }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('paid_amount, created_at')
      .gte('created_at', filters.from + 'T00:00:00')
      .lte('created_at', filters.to + 'T23:59:59'),
    supabase
      .from('purchases')
      .select('total_dt, created_at')
      .gte('created_at', filters.from + 'T00:00:00')
      .lte('created_at', filters.to + 'T23:59:59'),
    supabase
      .from('locker_payments')
      .select('amount_dt, created_at')
      .gte('created_at', filters.from + 'T00:00:00')
      .lte('created_at', filters.to + 'T23:59:59'),
  ])

  const subsMap = new Map<string, number>()
  subs?.forEach((r) => {
    const d = r.created_at.slice(0, 10)
    subsMap.set(d, (subsMap.get(d) ?? 0) + Number(r.paid_amount))
  })

  const posMap = new Map<string, number>()
  purchases?.forEach((r) => {
    const d = r.created_at.slice(0, 10)
    posMap.set(d, (posMap.get(d) ?? 0) + Number(r.total_dt))
  })

  const lockersMap = new Map<string, number>()
  lockerPayments?.forEach((r) => {
    const d = r.created_at.slice(0, 10)
    lockersMap.set(d, (lockersMap.get(d) ?? 0) + Number(r.amount_dt))
  })

  return enumerateDays(filters.from, filters.to).map((date) => ({
    date,
    subs: subsMap.get(date) ?? 0,
    pos: posMap.get(date) ?? 0,
    lockers: lockersMap.get(date) ?? 0,
  }))
}

export async function getExpensesByCategory(filters: { from: string; to: string }): Promise<ExpenseByCategory[]> {
  const supabase = await createSupabaseClient()

  const { data } = await supabase
    .from('expenses')
    .select('amount_dt, account_categories!inner(name)')
    .gte('date', filters.from)
    .lte('date', filters.to)

  const map = new Map<string, number>()
  data?.forEach((r) => {
    const cat = r.account_categories as unknown as { name: string }
    if (cat.name === 'Écart de caisse') return
    map.set(cat.name, (map.get(cat.name) ?? 0) + Number(r.amount_dt))
  })

  return Array.from(map.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)
}

export async function getCashFlow(filters: { from: string; to: string }): Promise<CashFlowPoint[]> {
  const supabase = await createSupabaseClient()

  const [{ data: subs }, { data: purchases }, { data: expenses }, { data: lockerPayments }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('paid_amount, created_at')
      .gte('created_at', filters.from + 'T00:00:00')
      .lte('created_at', filters.to + 'T23:59:59'),
    supabase
      .from('purchases')
      .select('total_dt, created_at')
      .gte('created_at', filters.from + 'T00:00:00')
      .lte('created_at', filters.to + 'T23:59:59'),
    supabase.from('expenses').select('amount_dt, date').gte('date', filters.from).lte('date', filters.to),
    supabase
      .from('locker_payments')
      .select('amount_dt, created_at')
      .gte('created_at', filters.from + 'T00:00:00')
      .lte('created_at', filters.to + 'T23:59:59'),
  ])

  const map = new Map<string, number>()
  subs?.forEach((r) => {
    const d = r.created_at.slice(0, 10)
    map.set(d, (map.get(d) ?? 0) + Number(r.paid_amount))
  })
  purchases?.forEach((r) => {
    const d = r.created_at.slice(0, 10)
    map.set(d, (map.get(d) ?? 0) + Number(r.total_dt))
  })
  lockerPayments?.forEach((r) => {
    const d = r.created_at.slice(0, 10)
    map.set(d, (map.get(d) ?? 0) + Number(r.amount_dt))
  })
  expenses?.forEach((r) => {
    const d = r.date.slice(0, 10)
    map.set(d, (map.get(d) ?? 0) - Number(r.amount_dt))
  })

  return enumerateDays(filters.from, filters.to).map((date) => ({ date, net: map.get(date) ?? 0 }))
}
