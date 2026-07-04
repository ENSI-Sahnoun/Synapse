import { describe, it, expect } from 'vitest'
import { classifySubscriptionStatus } from './subscriptions'

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
