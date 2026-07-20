import { describe, it, expect } from 'vitest'
import { pctDelta, previousPeriod } from './accounting'

describe('previousPeriod', () => {
  // A calendar month must compare against the whole previous calendar month.
  // The old fixed-day-count shift returned 2–31 May for June, a window the
  // owner cannot name and which omits 1 May entirely.
  it('compares a full calendar month against the whole previous month', () => {
    expect(previousPeriod('2026-06-01', '2026-06-30')).toEqual({
      from: '2026-05-01',
      to: '2026-05-31',
    })
  })

  // The default dashboard range is month-to-date, so the baseline is the same
  // slice of the previous month — not a window straddling two months.
  it('compares month-to-date against the same day range last month', () => {
    expect(previousPeriod('2026-03-01', '2026-03-20')).toEqual({
      from: '2026-02-01',
      to: '2026-02-20',
    })
  })

  it('clamps to the previous month length when the day does not exist', () => {
    expect(previousPeriod('2026-03-01', '2026-03-30')).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    })
  })

  it('handles a leap February', () => {
    expect(previousPeriod('2028-03-01', '2028-03-31')).toEqual({
      from: '2028-02-01',
      to: '2028-02-29',
    })
  })

  it('rolls the year back across January', () => {
    expect(previousPeriod('2026-01-01', '2026-01-31')).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    })
  })

  it('falls back to a same-length window for arbitrary ranges', () => {
    expect(previousPeriod('2026-06-10', '2026-06-19')).toEqual({
      from: '2026-05-31',
      to: '2026-06-09',
    })
  })

  it('handles a single-day range', () => {
    expect(previousPeriod('2026-07-04', '2026-07-04')).toEqual({
      from: '2026-07-03',
      to: '2026-07-03',
    })
  })
})

describe('pctDelta', () => {
  it('returns percentage change against the previous value', () => {
    expect(pctDelta(120, 100)).toBe(20)
    expect(pctDelta(80, 100)).toBe(-20)
  })

  // Dividing by a zero baseline yields Infinity, which renders as "▲ ∞%".
  // Callers must show "—" instead.
  it('returns null when there is no baseline', () => {
    expect(pctDelta(500, 0)).toBeNull()
  })

  // A loss-making previous period must not flip the sign of an improvement:
  // −100 → −50 is a 50% improvement, not −50%.
  it('uses the magnitude of a negative baseline', () => {
    expect(pctDelta(-50, -100)).toBe(50)
  })
})
