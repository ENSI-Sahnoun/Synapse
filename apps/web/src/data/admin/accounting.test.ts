import { describe, it, expect } from 'vitest'
import { previousPeriod } from './accounting'

describe('previousPeriod', () => {
  it('gives same-length window immediately before the range', () => {
    expect(previousPeriod('2026-06-01', '2026-06-30')).toEqual({
      from: '2026-05-02',
      to: '2026-05-31',
    })
  })

  it('handles a single-day range', () => {
    expect(previousPeriod('2026-07-04', '2026-07-04')).toEqual({
      from: '2026-07-03',
      to: '2026-07-03',
    })
  })
})
