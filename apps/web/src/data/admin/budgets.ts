import { createSupabaseClient } from '@/supabase-clients/server'
import { roundDt } from '@/lib/tz'

export type BudgetRow = {
  id: string
  accountCategoryId: string
  categoryName: string
  month: string
  amountDt: number
  note: string | null
}

export type BudgetVarianceRow = {
  categoryId: string
  categoryName: string
  budgetDt: number
  actualDt: number
  varianceDt: number
  // NULL from SQL whenever no budget exists for the category — unplanned spend.
  // Kept nullable so the UI renders "—" instead of a 0% that reads as
  // "nothing consumed" when in fact nothing was ever planned.
  consumedPct: number | null
}

export type PeriodLock = {
  month: string
  lockedBy: string
  lockedAt: string
  note: string | null
}

/**
 * First day of the month `date` falls in, as YYYY-MM-DD.
 *
 * `budgets.month` and `fiscal_period_locks.month` both carry a CHECK for
 * day = 1, so every read filter and every write must go through this rather
 * than passing the user's picked date straight down.
 */
export function toMonthStart(date: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(date)
  if (!match) throw new Error(`Mois invalide: ${date}`)
  const month = Number(match[2])
  if (month < 1 || month > 12) throw new Error(`Mois invalide: ${date}`)
  return `${match[1]}-${match[2]}-01`
}

// `budgets` and `fiscal_period_locks` are not yet in the hand-maintained
// database.types.ts, so the builder is cast locally instead of editing the
// shared types file.
type ReadBuilder<Row> = PromiseLike<{ data: Row[] | null; error: { message: string } | null }> & {
  select(columns: string): ReadBuilder<Row>
  eq(column: string, value: unknown): ReadBuilder<Row>
  order(column: string, options?: { ascending?: boolean }): ReadBuilder<Row>
  limit(count: number): ReadBuilder<Row>
}

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseClient>>

function untypedTable<Row>(supabase: SupabaseServerClient, table: string): ReadBuilder<Row> {
  return (supabase.from as unknown as (t: string) => ReadBuilder<Row>)(table)
}

function untypedRpc<Row>(
  supabase: SupabaseServerClient,
  fn: string,
  args: Record<string, unknown>,
): Promise<{ data: Row[] | null; error: { message: string } | null }> {
  return (
    supabase.rpc as unknown as (
      f: string,
      a: Record<string, unknown>,
    ) => Promise<{ data: Row[] | null; error: { message: string } | null }>
  )(fn, args)
}

type BudgetSelectRow = {
  id: string
  account_category_id: string
  month: string
  amount_dt: string | number
  note: string | null
  account_categories: { name: string } | null
}

export async function getBudgets(month: string): Promise<BudgetRow[]> {
  const supabase = await createSupabaseClient()

  const { data, error } = await untypedTable<BudgetSelectRow>(supabase, 'budgets')
    .select('id, account_category_id, month, amount_dt, note, account_categories!inner(name)')
    .eq('month', toMonthStart(month))
    .order('amount_dt', { ascending: false })
  if (error) throw new Error(error.message)

  return (data ?? []).map((r) => ({
    id: r.id,
    accountCategoryId: r.account_category_id,
    categoryName: r.account_categories?.name ?? 'Catégorie supprimée',
    month: r.month,
    amountDt: roundDt(Number(r.amount_dt)),
    note: r.note,
  }))
}

type BudgetVarianceSqlRow = {
  category_id: string
  category_name: string
  budget_dt: string | number
  actual_dt: string | number
  variance_dt: string | number
  consumed_pct: string | number | null
}

export async function getBudgetVariance(month: string): Promise<BudgetVarianceRow[]> {
  const supabase = await createSupabaseClient()

  const { data, error } = await untypedRpc<BudgetVarianceSqlRow>(supabase, 'analytics_budget_variance', {
    p_month: toMonthStart(month),
  })
  if (error) throw new Error(error.message)

  return (data ?? []).map((r) => ({
    categoryId: r.category_id,
    categoryName: r.category_name,
    budgetDt: roundDt(Number(r.budget_dt)),
    actualDt: roundDt(Number(r.actual_dt)),
    varianceDt: roundDt(Number(r.variance_dt)),
    consumedPct: r.consumed_pct === null ? null : roundDt(Number(r.consumed_pct)),
  }))
}

type PeriodLockSelectRow = {
  month: string
  locked_by: string
  locked_at: string
  note: string | null
}

export async function getPeriodLocks(): Promise<PeriodLock[]> {
  const supabase = await createSupabaseClient()

  const { data, error } = await untypedTable<PeriodLockSelectRow>(supabase, 'fiscal_period_locks')
    .select('month, locked_by, locked_at, note')
    .order('month', { ascending: false })
  if (error) throw new Error(error.message)

  return (data ?? []).map((r) => ({
    month: r.month,
    lockedBy: r.locked_by,
    lockedAt: r.locked_at,
    note: r.note,
  }))
}

/**
 * Whether writes dated into `month` are refused by the lock trigger.
 *
 * Worth checking before rendering any edit affordance: without it the owner
 * only discovers a closed period from a Postgres exception raised at save time,
 * after retyping the whole form.
 */
export async function isMonthLocked(month: string): Promise<boolean> {
  const supabase = await createSupabaseClient()

  const { data, error } = await untypedTable<{ month: string }>(supabase, 'fiscal_period_locks')
    .select('month')
    .eq('month', toMonthStart(month))
    .limit(1)
  if (error) throw new Error(error.message)

  return (data ?? []).length > 0
}
