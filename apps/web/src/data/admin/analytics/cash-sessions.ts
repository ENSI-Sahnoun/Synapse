import { createSupabaseClient } from '@/supabase-clients/server'
import { getPresetRange } from '@/lib/date-range'

export type CashSessionRow = {
  id: string
  status: string
  openedById: string
  openedByName: string
  openedByAvatarUrl: string | null
  openedAt: string
  openingAmountDt: number
  closedById: string | null
  closedByName: string | null
  closedByAvatarUrl: string | null
  closedAt: string | null
  closingAmountDt: number | null
  expectedAmountDt: number | null
  discrepancyDt: number | null
  notes: string | null
}

type CashSessionRawRow = {
  id: string
  status: string
  opened_by: string
  opened_at: string
  opening_amount_dt: number
  closed_by: string | null
  closed_at: string | null
  closing_amount_dt: number | null
  expected_amount_dt: number | null
  discrepancy_dt: number | null
  notes: string | null
  opener: { full_name: string; avatar_url: string | null } | null
  closer: { full_name: string; avatar_url: string | null } | null
}

function mapRow(r: CashSessionRawRow): CashSessionRow {
  return {
    id: r.id,
    status: r.status,
    openedById: r.opened_by,
    openedByName: r.opener?.full_name ?? 'Inconnu',
    openedByAvatarUrl: r.opener?.avatar_url ?? null,
    openedAt: r.opened_at,
    openingAmountDt: Number(r.opening_amount_dt),
    closedById: r.closed_by,
    closedByName: r.closer?.full_name ?? null,
    closedByAvatarUrl: r.closer?.avatar_url ?? null,
    closedAt: r.closed_at,
    closingAmountDt: r.closing_amount_dt === null ? null : Number(r.closing_amount_dt),
    expectedAmountDt: r.expected_amount_dt === null ? null : Number(r.expected_amount_dt),
    discrepancyDt: r.discrepancy_dt === null ? null : Number(r.discrepancy_dt),
    notes: r.notes,
  }
}

const SESSION_SELECT =
  'id, status, opened_by, opened_at, opening_amount_dt, closed_by, closed_at, closing_amount_dt, expected_amount_dt, discrepancy_dt, notes, opener:profiles!cash_register_sessions_opened_by_fkey(full_name, avatar_url), closer:profiles!cash_register_sessions_closed_by_fkey(full_name, avatar_url)'

export async function getCurrentCashSession(): Promise<CashSessionRow | null> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('cash_register_sessions')
    .select(SESSION_SELECT)
    .eq('status', 'open')
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapRow(data as unknown as CashSessionRawRow)
}

export async function getCashSessionHistory(range: { from: string; to: string }): Promise<CashSessionRow[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('cash_register_sessions')
    .select(SESSION_SELECT)
    .gte('opened_at', range.from + 'T00:00:00')
    .lte('opened_at', range.to + 'T23:59:59')
    .order('opened_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as CashSessionRawRow[]).map(mapRow)
}

export type CashSessionsSummary = {
  todayDiscrepancyDt: number
  nonZeroDiscrepancyCountThisWeek: number
}

export async function getCashSessionsSummary(): Promise<CashSessionsSummary> {
  const supabase = await createSupabaseClient()
  const today = getPresetRange('today')
  const week = getPresetRange('7d')

  const [{ data: todayRows, error: todayError }, { data: weekRows, error: weekError }] = await Promise.all([
    supabase
      .from('cash_register_sessions')
      .select('discrepancy_dt')
      .eq('status', 'closed')
      .gte('closed_at', today.from + 'T00:00:00')
      .lte('closed_at', today.to + 'T23:59:59'),
    supabase
      .from('cash_register_sessions')
      .select('discrepancy_dt')
      .eq('status', 'closed')
      .gte('closed_at', week.from + 'T00:00:00')
      .lte('closed_at', week.to + 'T23:59:59'),
  ])

  if (todayError) throw new Error(todayError.message)
  if (weekError) throw new Error(weekError.message)

  const todayDiscrepancyDt = (todayRows ?? []).reduce((sum, r) => sum + Number(r.discrepancy_dt ?? 0), 0)
  const nonZeroDiscrepancyCountThisWeek = (weekRows ?? []).filter(
    (r) => Math.abs(Number(r.discrepancy_dt ?? 0)) > 0.001,
  ).length

  return { todayDiscrepancyDt, nonZeroDiscrepancyCountThisWeek }
}
