import { describe, it, expect } from 'vitest'
import { monthEndDates, numberOrNull, recognizedDifference } from './recurring'

describe('recognizedDifference', () => {
  // Positive = cash banked ahead of delivery. This is the whole point of the
  // metric: a month full of annual plans looks spectacular on a cash basis.
  it('is positive when prepayments outrun delivered service', () => {
    expect(recognizedDifference(1200, 100)).toBe(1100)
  })

  it('is negative when the period lives off cash collected earlier', () => {
    expect(recognizedDifference(0, 250)).toBe(-250)
  })

  it('is zero when cash and delivery line up', () => {
    expect(recognizedDifference(500, 500)).toBe(0)
  })

  // Millime precision: without rounding this drifts to 0.30000000000000004 and
  // renders as a nonsense figure through `.toFixed(3)`.
  it('rounds to the millime', () => {
    expect(recognizedDifference(0.7, 0.4)).toBe(0.3)
  })
})

describe('monthEndDates', () => {
  it('returns the last N month-ends oldest first', () => {
    expect(monthEndDates(3, '2026-07-31')).toEqual(['2026-05-31', '2026-06-30', '2026-07-31'])
  })

  // The current month has not ended, so asking the RPC for a future date would
  // count memberships scheduled to start but not yet started.
  it('clamps the newest point to today mid-month', () => {
    expect(monthEndDates(3, '2026-07-20')).toEqual(['2026-05-31', '2026-06-30', '2026-07-20'])
  })

  it('rolls back across the year boundary', () => {
    expect(monthEndDates(3, '2026-01-31')).toEqual(['2025-11-30', '2025-12-31', '2026-01-31'])
  })

  it('handles a leap February', () => {
    expect(monthEndDates(2, '2028-03-31')).toEqual(['2028-02-29', '2028-03-31'])
  })

  it('returns a single date for a one-month window', () => {
    expect(monthEndDates(1, '2026-07-20')).toEqual(['2026-07-20'])
  })

  it('returns nothing for a zero-month window', () => {
    expect(monthEndDates(0, '2026-07-20')).toEqual([])
  })
})

describe('numberOrNull', () => {
  it('parses the string Postgres sends for numeric columns', () => {
    expect(numberOrNull('42.5')).toBe(42.5)
  })

  // An empty renewal cohort means "nobody was up for renewal", which must not
  // collapse into a confident 0% — `Number(null)` would do exactly that.
  it('preserves null rather than coercing it to zero', () => {
    expect(numberOrNull(null)).toBeNull()
  })
})
