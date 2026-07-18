import { describe, it, expect } from 'vitest'
import { extractPriceChange } from './price-history'

describe('extractPriceChange', () => {
  it('extracts old and new price_dt when present', () => {
    const details = { old: { price_dt: 5 }, new: { price_dt: 7 } }
    expect(extractPriceChange(details)).toEqual({ oldPrice: 5, newPrice: 7 })
  })

  it('returns null oldPrice on create (no old.price_dt)', () => {
    const details = { new: { price_dt: 5 } }
    expect(extractPriceChange(details)).toEqual({ oldPrice: null, newPrice: 5 })
  })

  it('returns null when neither side has a price', () => {
    const details = { old: { name: 'x' }, new: { name: 'y' } }
    expect(extractPriceChange(details)).toBeNull()
  })

  it('returns null for malformed details', () => {
    expect(extractPriceChange(null)).toBeNull()
    expect(extractPriceChange('nonsense')).toBeNull()
  })
})
