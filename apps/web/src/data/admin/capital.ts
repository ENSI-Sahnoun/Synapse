import { createSupabaseClient } from '@/supabase-clients/server'
import { roundDt } from '@/lib/tz'

export type CapitalAccount = 'cash' | 'bank'

export type CapitalBalances = { cash: number; bank: number; total: number }

export function computeCapitalBalances(input: {
  movements: { account: CapitalAccount; amount_dt: number }[]
  transfers: { from_account: CapitalAccount; to_account: CapitalAccount; amount_dt: number }[]
  totalRevenue: number
  totalExpenses: number
}): CapitalBalances {
  let cash = input.totalRevenue - input.totalExpenses
  let bank = 0

  for (const m of input.movements) {
    if (m.account === 'cash') cash += m.amount_dt
    else bank += m.amount_dt
  }

  for (const t of input.transfers) {
    if (t.from_account === 'cash') cash -= t.amount_dt
    else bank -= t.amount_dt

    if (t.to_account === 'cash') cash += t.amount_dt
    else bank += t.amount_dt
  }

  return { cash: roundDt(cash), bank: roundDt(bank), total: roundDt(cash + bank) }
}

export async function getCapitalBalances(): Promise<CapitalBalances> {
  const supabase = await createSupabaseClient()

  // The four revenue/expense totals are all-time and MUST be aggregated in SQL.
  // Fetching the rows and summing them in JS silently truncated at the 1000-row
  // cap configured in apps/database/supabase/config.toml, and `purchases` is
  // the table that crosses 1000 first in a POS-driven gym — so revenue froze
  // while expenses kept accruing and the Caisse figure drifted downward without
  // bound, with no error and no warning. `capital_movements` / `capital_transfers`
  // stay as row fetches: they are hand-entered and orders of magnitude smaller.
  const [{ data: movements }, { data: transfers }, { data: totals, error: totalsError }] = await Promise.all([
    supabase.from('capital_movements').select('account, amount_dt'),
    supabase.from('capital_transfers').select('from_account, to_account, amount_dt'),
    supabase.rpc('analytics_capital_totals').single(),
  ])
  if (totalsError) throw new Error(totalsError.message)

  const totalRevenue = Number(totals.subs) + Number(totals.pos) + Number(totals.lockers)
  const totalExpenses = Number(totals.expenses)

  return computeCapitalBalances({
    movements: (movements ?? []).map((m) => ({ account: m.account as CapitalAccount, amount_dt: Number(m.amount_dt) })),
    transfers: (transfers ?? []).map((t) => ({
      from_account: t.from_account as CapitalAccount,
      to_account: t.to_account as CapitalAccount,
      amount_dt: Number(t.amount_dt),
    })),
    totalRevenue,
    totalExpenses,
  })
}

export type CapitalHistoryEntry = {
  id: string
  kind: 'movement' | 'transfer'
  account: string
  amount_dt: number
  date: string
  note: string | null
  created_at: string
}

export async function getCapitalHistory(): Promise<CapitalHistoryEntry[]> {
  const supabase = await createSupabaseClient()

  const [{ data: movements }, { data: transfers }] = await Promise.all([
    supabase
      .from('capital_movements')
      .select('id, account, amount_dt, date, note, created_at')
      .order('date', { ascending: false }),
    supabase
      .from('capital_transfers')
      .select('id, from_account, to_account, amount_dt, date, note, created_at')
      .order('date', { ascending: false }),
  ])

  const entries: CapitalHistoryEntry[] = [
    ...(movements ?? []).map((m) => ({
      id: m.id,
      kind: 'movement' as const,
      account: m.account === 'cash' ? 'Caisse' : 'Banque',
      amount_dt: Number(m.amount_dt),
      date: m.date,
      note: m.note,
      created_at: m.created_at,
    })),
    ...(transfers ?? []).map((t) => ({
      id: t.id,
      kind: 'transfer' as const,
      account: `${t.from_account === 'cash' ? 'Caisse' : 'Banque'} → ${t.to_account === 'cash' ? 'Caisse' : 'Banque'}`,
      amount_dt: Number(t.amount_dt),
      date: t.date,
      note: t.note,
      created_at: t.created_at,
    })),
  ]

  return entries.sort((a, b) => b.date.localeCompare(a.date))
}
