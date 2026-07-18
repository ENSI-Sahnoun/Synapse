import { createSupabaseClient } from '@/supabase-clients/server'

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

  return { cash, bank, total: cash + bank }
}

export async function getCapitalBalances(): Promise<CapitalBalances> {
  const supabase = await createSupabaseClient()

  const [{ data: movements }, { data: transfers }, { data: subs }, { data: purchases }, { data: lockerPayments }, { data: expenses }] =
    await Promise.all([
      supabase.from('capital_movements').select('account, amount_dt'),
      supabase.from('capital_transfers').select('from_account, to_account, amount_dt'),
      supabase.from('subscriptions').select('paid_amount'),
      supabase.from('purchases').select('total_dt'),
      supabase.from('locker_payments').select('amount_dt'),
      supabase.from('expenses').select('amount_dt'),
    ])

  const totalRevenue =
    (subs?.reduce((s, r) => s + Number(r.paid_amount), 0) ?? 0) +
    (purchases?.reduce((s, r) => s + Number(r.total_dt), 0) ?? 0) +
    (lockerPayments?.reduce((s, r) => s + Number(r.amount_dt), 0) ?? 0)

  const totalExpenses = expenses?.reduce((s, r) => s + Number(r.amount_dt), 0) ?? 0

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
