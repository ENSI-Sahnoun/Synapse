import { describe, it, expect } from 'vitest'
import { computeSubscriptionState } from './subscription-status'

describe('computeSubscriptionState', () => {
  const TODAY = '2026-07-12'

  it('is active when more than 3 days remain', () => {
    expect(computeSubscriptionState('2026-07-16', TODAY)).toBe('active')
  })

  it('is expiring_soon at exactly 3 days left', () => {
    expect(computeSubscriptionState('2026-07-15', TODAY)).toBe('expiring_soon')
  })

  it('is expires_today on the last valid day, for any plan duration (incl. 1-day plans)', () => {
    expect(computeSubscriptionState('2026-07-12', TODAY)).toBe('expires_today')
  })

  it('is expired the day after end date', () => {
    expect(computeSubscriptionState('2026-07-11', TODAY)).toBe('expired')
  })

  it('handles month boundaries via real date math, not string diff', () => {
    expect(computeSubscriptionState('2026-08-01', '2026-07-30')).toBe('expiring_soon')
  })
})
