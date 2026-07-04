import { describe, it, expect } from 'vitest'
import { averageSessionMinutes } from './attendance'

describe('averageSessionMinutes', () => {
  it('averages minutes between check-in and check-out', () => {
    const sessions = [
      { checkedInAt: '2026-07-04T10:00:00Z', checkedOutAt: '2026-07-04T11:00:00Z' },
      { checkedInAt: '2026-07-04T10:00:00Z', checkedOutAt: '2026-07-04T10:30:00Z' },
    ]
    expect(averageSessionMinutes(sessions)).toBe(45)
  })

  it('returns 0 for no sessions', () => {
    expect(averageSessionMinutes([])).toBe(0)
  })
})
