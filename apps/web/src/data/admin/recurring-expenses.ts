import { createSupabaseClient } from '@/supabase-clients/server'
import { roundDt, tunisDate } from '@/lib/tz'
import type { RecurringFrequency } from '@/utils/zod-schemas/recurring-expense'

export type RecurringExpenseRow = {
  id: string
  accountCategoryId: string
  categoryName: string
  description: string
  amountDt: number
  frequency: RecurringFrequency
  dayOfMonth: number
  startsOn: string
  endsOn: string | null
  isActive: boolean
}

export type UnpostedRecurringExpense = RecurringExpenseRow & {
  /** The occurrence date that should already exist in `expenses`. */
  dueOn: string
}

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseClient>>

// `recurring_expenses` and `expenses.recurring_expense_id` are not yet in the
// hand-maintained database.types.ts, so the builder is cast locally.
type ReadBuilder<Row> = PromiseLike<{ data: Row[] | null; error: { message: string } | null }> & {
  select(columns: string): ReadBuilder<Row>
  eq(column: string, value: unknown): ReadBuilder<Row>
  gte(column: string, value: unknown): ReadBuilder<Row>
  lt(column: string, value: unknown): ReadBuilder<Row>
  not(column: string, operator: string, value: unknown): ReadBuilder<Row>
  order(column: string, options?: { ascending?: boolean }): ReadBuilder<Row>
}

function untypedTable<Row>(supabase: SupabaseServerClient, table: string): ReadBuilder<Row> {
  return (supabase.from as unknown as (t: string) => ReadBuilder<Row>)(table)
}

/** Months between two YYYY-MM-DD dates, ignoring the day component. */
function monthIndex(date: string): number {
  const [year, month] = date.split('-').map(Number)
  return year * 12 + (month - 1)
}

const stepMonths: Record<RecurringFrequency, number> = { monthly: 1, quarterly: 3, yearly: 12 }

/**
 * The single monthly figure a non-monthly commitment is worth.
 *
 * A 900 DT quarterly insurance premium is 300 DT/month of fixed cost; showing
 * the raw 900 next to a 1 200 DT monthly rent would triple-count it in the
 * owner's "what do I owe every month" number.
 */
export function monthlyEquivalent(amountDt: number, frequency: RecurringFrequency): number {
  return roundDt(amountDt / stepMonths[frequency])
}

export type RecurrenceRule = {
  frequency: RecurringFrequency
  dayOfMonth: number
  startsOn: string
  endsOn: string | null
}

/**
 * The occurrence date this rule falls on inside `monthStart`'s month, or null
 * when the month has no occurrence.
 *
 * Mirrors `materialise_recurring_expenses`: the first occurrence is
 * `day_of_month` in the starting month, pushed to the next month when that day
 * has already passed on `starts_on`, and every subsequent one steps by the
 * frequency from there.
 */
export function dueDateInMonth(rule: RecurrenceRule, monthStart: string): string | null {
  const startDay = Number(rule.startsOn.slice(8, 10))
  const firstMonth = monthIndex(rule.startsOn) + (rule.dayOfMonth >= startDay ? 0 : 1)
  const target = monthIndex(monthStart)

  const elapsed = target - firstMonth
  if (elapsed < 0 || elapsed % stepMonths[rule.frequency] !== 0) return null

  const due = `${monthStart.slice(0, 7)}-${String(rule.dayOfMonth).padStart(2, '0')}`
  if (rule.endsOn && due > rule.endsOn) return null
  return due
}

type RecurringSelectRow = {
  id: string
  account_category_id: string
  description: string
  amount_dt: string | number
  frequency: RecurringFrequency
  day_of_month: number
  starts_on: string
  ends_on: string | null
  is_active: boolean
  account_categories: { name: string } | null
}

function mapRow(r: RecurringSelectRow): RecurringExpenseRow {
  return {
    id: r.id,
    accountCategoryId: r.account_category_id,
    categoryName: r.account_categories?.name ?? 'Catégorie supprimée',
    description: r.description,
    amountDt: roundDt(Number(r.amount_dt)),
    frequency: r.frequency,
    dayOfMonth: r.day_of_month,
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    isActive: r.is_active,
  }
}

const RECURRING_COLUMNS =
  'id, account_category_id, description, amount_dt, frequency, day_of_month, starts_on, ends_on, is_active, account_categories!inner(name)'

export async function getRecurringExpenses(): Promise<RecurringExpenseRow[]> {
  const supabase = await createSupabaseClient()

  const { data, error } = await untypedTable<RecurringSelectRow>(supabase, 'recurring_expenses')
    .select(RECURRING_COLUMNS)
    .order('is_active', { ascending: false })
    .order('amount_dt', { ascending: false })
  if (error) throw new Error(error.message)

  return (data ?? []).map(mapRow)
}

/**
 * The fixed monthly nut: everything the business owes every month regardless of
 * whether a single customer walks in, with quarterly and yearly commitments
 * normalised to their monthly share.
 *
 * Rules that have already ended are excluded — an expired lease is not a
 * commitment, and leaving it in would keep inflating the headline long after
 * the money stopped going out.
 */
export async function getMonthlyCommitment(): Promise<number> {
  const supabase = await createSupabaseClient()
  const today = tunisDate()

  const { data, error } = await untypedTable<{
    amount_dt: string | number
    frequency: RecurringFrequency
    ends_on: string | null
  }>(supabase, 'recurring_expenses')
    .select('amount_dt, frequency, ends_on')
    .eq('is_active', true)
  if (error) throw new Error(error.message)

  return roundDt(
    (data ?? [])
      .filter((r) => !r.ends_on || r.ends_on >= today)
      .reduce((sum, r) => sum + monthlyEquivalent(Number(r.amount_dt), r.frequency), 0),
  )
}

/**
 * Active recurring expenses whose occurrence for the current month has already
 * come due but has no `expenses` row behind it.
 *
 * The daily cron normally materialises these, so a non-empty list means either
 * the cron is not running or someone deleted the posted row — both cases where
 * the P&L currently understates costs and looks better than reality.
 */
export async function getUnpostedThisMonth(): Promise<UnpostedRecurringExpense[]> {
  const supabase = await createSupabaseClient()
  const today = tunisDate()
  const monthStart = `${today.slice(0, 7)}-01`

  const [{ data: rules, error: rulesError }, { data: posted, error: postedError }] = await Promise.all([
    untypedTable<RecurringSelectRow>(supabase, 'recurring_expenses')
      .select(RECURRING_COLUMNS)
      .eq('is_active', true),
    untypedTable<{ recurring_expense_id: string; date: string }>(supabase, 'expenses')
      .select('recurring_expense_id, date')
      .not('recurring_expense_id', 'is', null)
      .gte('date', monthStart),
  ])
  if (rulesError) throw new Error(rulesError.message)
  if (postedError) throw new Error(postedError.message)

  // Keyed on rule + exact date: the unique index is on that pair, so a row
  // posted for a different day of the same month does not satisfy this
  // occurrence.
  const postedKeys = new Set((posted ?? []).map((r) => `${r.recurring_expense_id}|${r.date.slice(0, 10)}`))

  const result: UnpostedRecurringExpense[] = []
  for (const raw of rules ?? []) {
    const row = mapRow(raw)
    const dueOn = dueDateInMonth(row, monthStart)
    if (!dueOn || dueOn > today) continue
    if (postedKeys.has(`${row.id}|${dueOn}`)) continue
    result.push({ ...row, dueOn })
  }

  return result.sort((a, b) => a.dueOn.localeCompare(b.dueOn) || b.amountDt - a.amountDt)
}
