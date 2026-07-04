import { describe, it, expect } from 'vitest'
import { salesPerShift } from './staff'

describe('salesPerShift', () => {
  it('divides total sales by shifts worked', () => {
    expect(salesPerShift(300, 4)).toBe(75)
  })

  it('returns 0 when no shifts worked', () => {
    expect(salesPerShift(300, 0)).toBe(0)
  })
})
