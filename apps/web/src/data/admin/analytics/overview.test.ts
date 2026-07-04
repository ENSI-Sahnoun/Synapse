import { describe, it, expect } from 'vitest'
import { diffDelta } from './overview'

describe('diffDelta', () => {
  it('returns positive delta when current exceeds previous', () => {
    expect(diffDelta(150, 100)).toBe(50)
  })

  it('returns negative delta when current is below previous', () => {
    expect(diffDelta(80, 100)).toBe(-20)
  })

  it('returns zero when unchanged', () => {
    expect(diffDelta(100, 100)).toBe(0)
  })
})
