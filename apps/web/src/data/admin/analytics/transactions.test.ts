import { describe, it, expect } from 'vitest'
import { mergeTransactions } from './transactions'
import type { Transaction } from './transactions'

describe('mergeTransactions', () => {
  it('sorts all three transaction types together by time, descending', () => {
    const purchases: Transaction[] = [
      { type: 'purchase', id: 'p1', at: '2026-07-01T10:00:00Z', who: 'Alice', items: [], total: 5, voided: false },
    ]
    const subscriptions: Transaction[] = [
      { type: 'subscription', id: 's1', at: '2026-07-01T12:00:00Z', who: 'Bob', planId: 'x', planName: 'Mensuel', amount: 100, voided: false },
    ]
    const charges: Transaction[] = [
      { type: 'charge', id: 'c1', at: '2026-07-01T08:00:00Z', who: 'Carol', productId: 'y', productName: 'Café', qty: 1, amount: 2 },
    ]
    const merged = mergeTransactions(purchases, subscriptions, charges)
    expect(merged.map((t) => t.id)).toEqual(['s1', 'p1', 'c1'])
  })

  it('returns empty array when all inputs are empty', () => {
    expect(mergeTransactions([], [], [])).toEqual([])
  })
})
