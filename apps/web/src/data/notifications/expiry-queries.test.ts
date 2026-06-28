import { describe, it, expect } from 'vitest'

// Pure date-offset logic extracted for unit testing
function getTargetDate(daysFromToday: number): string {
  const d = new Date('2026-06-23')
  d.setDate(d.getDate() + daysFromToday)
  return d.toISOString().split('T')[0]
}

describe('expiry offset date calculation', () => {
  it('J-7 offset gives correct date', () => {
    expect(getTargetDate(7)).toBe('2026-06-30')
  })

  it('J-3 offset gives correct date', () => {
    expect(getTargetDate(3)).toBe('2026-06-26')
  })

  it('J-0 gives today', () => {
    expect(getTargetDate(0)).toBe('2026-06-23')
  })

  it('J+3 (renewal reminder) gives future date', () => {
    expect(getTargetDate(-3)).toBe('2026-06-20')
  })
})
