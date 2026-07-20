import { describe, it, expect } from 'vitest'
import { toMonthStart } from './budgets'
import { dueDateInMonth, monthlyEquivalent } from './recurring-expenses'

describe('toMonthStart', () => {
  it('snaps any day of the month to the first', () => {
    expect(toMonthStart('2026-07-20')).toBe('2026-07-01')
    expect(toMonthStart('2026-07-01')).toBe('2026-07-01')
    expect(toMonthStart('2026-02-29')).toBe('2026-02-01')
  })

  it('accepts a bare YYYY-MM', () => {
    expect(toMonthStart('2026-12')).toBe('2026-12-01')
  })

  it('preserves the year across December and January', () => {
    expect(toMonthStart('2025-12-31')).toBe('2025-12-01')
    expect(toMonthStart('2026-01-01')).toBe('2026-01-01')
  })

  it('rejects malformed input rather than producing an invalid month', () => {
    expect(() => toMonthStart('20/07/2026')).toThrow()
    expect(() => toMonthStart('2026-13-01')).toThrow()
    expect(() => toMonthStart('2026-00-01')).toThrow()
    expect(() => toMonthStart('')).toThrow()
  })
})

describe('monthlyEquivalent', () => {
  it('leaves monthly commitments untouched', () => {
    expect(monthlyEquivalent(1200, 'monthly')).toBe(1200)
  })

  it('spreads quarterly over three months and yearly over twelve', () => {
    expect(monthlyEquivalent(900, 'quarterly')).toBe(300)
    expect(monthlyEquivalent(1200, 'yearly')).toBe(100)
  })

  it('rounds to the millime', () => {
    // 100 / 3 would otherwise carry a full double's worth of digits into the
    // headline figure.
    expect(monthlyEquivalent(100, 'quarterly')).toBe(33.333)
    expect(monthlyEquivalent(1000, 'yearly')).toBe(83.333)
  })
})

describe('dueDateInMonth', () => {
  const monthly = { frequency: 'monthly' as const, dayOfMonth: 5, startsOn: '2026-01-01', endsOn: null }

  it('returns the occurrence date for a monthly rule', () => {
    expect(dueDateInMonth(monthly, '2026-07-01')).toBe('2026-07-05')
  })

  it('pads single-digit days', () => {
    expect(dueDateInMonth({ ...monthly, dayOfMonth: 3 }, '2026-11-01')).toBe('2026-11-03')
  })

  it('returns null before the rule starts', () => {
    expect(dueDateInMonth({ ...monthly, startsOn: '2026-08-01' }, '2026-07-01')).toBeNull()
  })

  it('skips the starting month when its due day already passed on starts_on', () => {
    // Rule created on the 20th with a 5th-of-month billing day: the first
    // occurrence is next month, matching materialise_recurring_expenses.
    expect(dueDateInMonth({ ...monthly, startsOn: '2026-01-20' }, '2026-01-01')).toBeNull()
    expect(dueDateInMonth({ ...monthly, startsOn: '2026-01-20' }, '2026-02-01')).toBe('2026-02-05')
  })

  it('steps quarterly rules three months at a time from the first occurrence', () => {
    const quarterly = { ...monthly, frequency: 'quarterly' as const, startsOn: '2026-02-01' }
    expect(dueDateInMonth(quarterly, '2026-02-01')).toBe('2026-02-05')
    expect(dueDateInMonth(quarterly, '2026-03-01')).toBeNull()
    expect(dueDateInMonth(quarterly, '2026-05-01')).toBe('2026-05-05')
  })

  it('steps yearly rules across the year boundary', () => {
    const yearly = { ...monthly, frequency: 'yearly' as const, startsOn: '2025-09-01' }
    expect(dueDateInMonth(yearly, '2026-09-01')).toBe('2026-09-05')
    expect(dueDateInMonth(yearly, '2026-08-01')).toBeNull()
  })

  it('stops at ends_on', () => {
    expect(dueDateInMonth({ ...monthly, endsOn: '2026-07-04' }, '2026-07-01')).toBeNull()
    expect(dueDateInMonth({ ...monthly, endsOn: '2026-07-05' }, '2026-07-01')).toBe('2026-07-05')
  })
})
