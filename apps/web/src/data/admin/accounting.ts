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
