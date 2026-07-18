import { describe, it, expect } from 'vitest'
import { classifySubscriptionStatus, plansChangedSince } from './subscriptions'

describe('classifySubscriptionStatus', () => {
  it('is expired when end_date is before today', () => {
    expect(classifySubscriptionStatus('2026-06-01', '2026-07-04')).toBe('expired')
  })

  it('is expiring_soon when end_date is within 7 days', () => {
    expect(classifySubscriptionStatus('2026-07-08', '2026-07-04')).toBe('expiring_soon')
  })

  it('is active when end_date is more than 7 days out', () => {
    expect(classifySubscriptionStatus('2026-08-01', '2026-07-04')).toBe('active')
  })

  it('treats end_date equal to today as expiring_soon, not expired', () => {
    expect(classifySubscriptionStatus('2026-07-04', '2026-07-04')).toBe('expiring_soon')
  })
})

describe('plansChangedSince', () => {
  it('returns true when a log row for the plan is after the given timestamp', () => {
    const rows = [{ plan_id: 'p1', created_at: '2026-07-10T00:00:00Z' }]
    const changed = plansChangedSince(rows)
    expect(changed('p1', '2026-07-05T00:00:00Z')).toBe(true)
  })

  it('returns false when the only log row is before the given timestamp', () => {
    const rows = [{ plan_id: 'p1', created_at: '2026-07-01T00:00:00Z' }]
    const changed = plansChangedSince(rows)
    expect(changed('p1', '2026-07-05T00:00:00Z')).toBe(false)
  })

  it('returns false for a plan with no log rows', () => {
    const rows: { plan_id: string | null; created_at: string }[] = []
    const changed = plansChangedSince(rows)
    expect(changed('p1', '2026-07-05T00:00:00Z')).toBe(false)
  })

  it('ignores rows with a null plan_id', () => {
    const rows = [{ plan_id: null, created_at: '2026-07-10T00:00:00Z' }]
    const changed = plansChangedSince(rows)
    expect(changed('p1', '2026-07-05T00:00:00Z')).toBe(false)
  })
})
