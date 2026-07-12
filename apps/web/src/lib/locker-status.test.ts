import { describe, it, expect } from 'vitest'
import { computeLockerStatus, computeLockerBadgeState } from './locker-status'

const TODAY = '2026-07-11'

describe('computeLockerStatus', () => {
  it('is unavailable when is_unavailable is true, regardless of assignment', () => {
    const status = computeLockerStatus(
      { isUnavailable: true, assignedStudentId: 'student-1', subscriptionEndDate: '2026-12-31' },
      TODAY,
    )
    expect(status).toBe('unavailable')
  })

  it('is available when nothing is assigned', () => {
    const status = computeLockerStatus(
      { isUnavailable: false, assignedStudentId: null, subscriptionEndDate: null },
      TODAY,
    )
    expect(status).toBe('available')
  })

  it('is occupied when assigned and the linked subscription end_date is today or later', () => {
    const status = computeLockerStatus(
      { isUnavailable: false, assignedStudentId: 'student-1', subscriptionEndDate: '2026-07-11' },
      TODAY,
    )
    expect(status).toBe('occupied')
  })

  it('is available when assigned but the linked subscription end_date is in the past', () => {
    const status = computeLockerStatus(
      { isUnavailable: false, assignedStudentId: 'student-1', subscriptionEndDate: '2026-07-10' },
      TODAY,
    )
    expect(status).toBe('available')
  })

  it('is available when assigned but there is no linked subscription end_date', () => {
    const status = computeLockerStatus(
      { isUnavailable: false, assignedStudentId: 'student-1', subscriptionEndDate: null },
      TODAY,
    )
    expect(status).toBe('available')
  })
})

describe('computeLockerBadgeState', () => {
  const TODAY = '2026-07-12'

  it('is active when more than 3 days remain', () => {
    expect(computeLockerBadgeState('2026-07-16', TODAY)).toBe('active')
  })

  it('is expiring_soon at exactly 3 days left', () => {
    expect(computeLockerBadgeState('2026-07-15', TODAY)).toBe('expiring_soon')
  })

  it('is expiring_soon on the last day (expires today)', () => {
    expect(computeLockerBadgeState('2026-07-12', TODAY)).toBe('expiring_soon')
  })

  it('is expired the day after end date', () => {
    expect(computeLockerBadgeState('2026-07-11', TODAY)).toBe('expired')
  })

  it('handles month boundaries via real date math, not string diff', () => {
    expect(computeLockerBadgeState('2026-08-01', '2026-07-30')).toBe('expiring_soon')
  })
})
