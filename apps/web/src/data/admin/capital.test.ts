import { describe, it, expect } from 'vitest'
import { computeCapitalBalances } from './capital'

describe('computeCapitalBalances', () => {
  it('nets opening balances, revenue, expenses, and transfers per account', () => {
    const result = computeCapitalBalances({
      movements: [
        { account: 'cash', amount_dt: 1000 }, // opening cash
        { account: 'bank', amount_dt: 500 }, // opening bank
        { account: 'cash', amount_dt: -100 }, // owner draw from cash
      ],
      transfers: [
        { from_account: 'cash', to_account: 'bank', amount_dt: 200 },
      ],
      totalRevenue: 300,
      totalExpenses: 50,
    })

    // cash = 1000 - 100 + 300 - 50 - 200 = 950
    // bank = 500 + 200 = 700
    expect(result).toEqual({ cash: 950, bank: 700, total: 1650 })
  })

  it('returns zeros when there is no data', () => {
    const result = computeCapitalBalances({
      movements: [],
      transfers: [],
      totalRevenue: 0,
      totalExpenses: 0,
    })
    expect(result).toEqual({ cash: 0, bank: 0, total: 0 })
  })
})
