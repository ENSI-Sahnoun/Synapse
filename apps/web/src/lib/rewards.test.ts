import { describe, it, expect } from 'vitest'
import { getNextReward, weeklyDelta, type LoyaltyRule } from './rewards'

const rule = (id: string, threshold: number): LoyaltyRule => ({
  id,
  name: `R${id}`,
  reward_type: 'free_coffee',
  points_threshold: threshold,
  reward_value: null,
})

describe('getNextReward', () => {
  it('returns cheapest unaffordable rule with missing points and progress', () => {
    const rules = [rule('a', 100), rule('b', 500), rule('c', 200)]
    const next = getNextReward(140, rules)
    expect(next?.rule.id).toBe('c')
    expect(next?.missing).toBe(60)
    expect(next?.progressPct).toBe(70)
  })

  it('returns null when all rules affordable', () => {
    expect(getNextReward(600, [rule('a', 100), rule('b', 500)])).toBeNull()
  })

  it('returns null when no rules', () => {
    expect(getNextReward(0, [])).toBeNull()
  })

  it('clamps progress at 0 for zero balance', () => {
    const next = getNextReward(0, [rule('a', 200)])
    expect(next?.progressPct).toBe(0)
    expect(next?.missing).toBe(200)
  })
})

describe('weeklyDelta', () => {
  const now = new Date('2026-07-05T12:00:00Z')
  it('sums entries within last 7 days only', () => {
    const ledger = [
      { points_delta: 30, created_at: '2026-07-04T10:00:00Z' },
      { points_delta: 15, created_at: '2026-06-30T10:00:00Z' },
      { points_delta: -10, created_at: '2026-07-01T10:00:00Z' },
      { points_delta: 99, created_at: '2026-06-01T10:00:00Z' },
    ]
    expect(weeklyDelta(ledger, now)).toBe(35)
  })

  it('returns 0 for empty ledger', () => {
    expect(weeklyDelta([], now)).toBe(0)
  })
})
