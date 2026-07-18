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
