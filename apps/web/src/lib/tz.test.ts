import { describe, it, expect } from 'vitest'
import {
  addDays,
  daysBetween,
  enumerateDays,
  roundDt,
  tunisDate,
  tunisDayEndExclusive,
  tunisDayStart,
  tunisRange,
} from './tz'

describe('tunisDayStart', () => {
  // Tunisia is permanently UTC+1 (no DST since 2009). The offset must be
  // present: a bare 'T00:00:00' is resolved as UTC by PostgREST, which is the
  // bug this module exists to prevent.
  it('emits an offset-qualified timestamp', () => {
    expect(tunisDayStart('2026-07-20')).toBe('2026-07-20T00:00:00+01:00')
  })

  it('uses the same offset in winter', () => {
    expect(tunisDayStart('2026-01-15')).toBe('2026-01-15T00:00:00+01:00')
  })
})

describe('tunisDayEndExclusive', () => {
  // Exclusive bound, paired with .lt(). The old `.lte(to + 'T23:59:59')`
  // dropped every row in the final 999 ms of the period.
  it('is the start of the following day', () => {
    expect(tunisDayEndExclusive('2026-07-20')).toBe('2026-07-21T00:00:00+01:00')
  })

  it('rolls over month ends', () => {
    expect(tunisDayEndExclusive('2026-07-31')).toBe('2026-08-01T00:00:00+01:00')
  })

  it('rolls over year ends', () => {
    expect(tunisDayEndExclusive('2026-12-31')).toBe('2027-01-01T00:00:00+01:00')
  })
})

describe('tunisDate', () => {
  // 23:30 UTC is already the next day in Tunis. Bucketing this instant by its
  // UTC date is exactly how late-evening sales landed in the wrong day — and
  // in the wrong month on the last day of a month.
  it('resolves a late-evening UTC instant to the next Tunis day', () => {
    expect(tunisDate(new Date('2026-07-20T23:30:00Z'))).toBe('2026-07-21')
  })

  it('resolves a midday instant to the same day', () => {
    expect(tunisDate(new Date('2026-07-20T12:00:00Z'))).toBe('2026-07-20')
  })

  it('rolls the month over for a sale just before midnight on the 31st', () => {
    expect(tunisDate(new Date('2026-07-31T23:10:00Z'))).toBe('2026-08-01')
  })
})

describe('tunisRange', () => {
  it('produces a half-open interval covering the whole inclusive range', () => {
    expect(tunisRange('2026-07-01', '2026-07-31')).toEqual({
      start: '2026-07-01T00:00:00+01:00',
      endExclusive: '2026-08-01T00:00:00+01:00',
    })
  })
})

describe('addDays', () => {
  it('moves forward across a month boundary', () => {
    expect(addDays('2026-07-31', 1)).toBe('2026-08-01')
  })

  it('moves backward across a year boundary', () => {
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('handles leap days', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })
})

describe('daysBetween', () => {
  it('counts inclusively', () => {
    expect(daysBetween('2026-07-01', '2026-07-31')).toBe(31)
    expect(daysBetween('2026-07-04', '2026-07-04')).toBe(1)
  })
})

describe('enumerateDays', () => {
  it('lists every day inclusive of both ends', () => {
    expect(enumerateDays('2026-07-30', '2026-08-02')).toEqual([
      '2026-07-30',
      '2026-07-31',
      '2026-08-01',
      '2026-08-02',
    ])
  })
})

describe('roundDt', () => {
  // Summing doubles drifts: 0.1 + 0.2 === 0.30000000000000004, which reaches
  // the UI through .toFixed(3) and makes reconciled balances look off.
  it('collapses floating-point drift to the millime', () => {
    expect(roundDt(0.1 + 0.2)).toBe(0.3)
    expect(roundDt(1234.5670000000002)).toBe(1234.567)
  })

  it('preserves millime precision', () => {
    expect(roundDt(12.3456)).toBe(12.346)
  })
})
