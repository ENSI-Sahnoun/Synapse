import { describe, it, expect } from 'vitest'
import { rankBestSellers } from './pos'
import type { BestSeller } from './pos'

const sample: BestSeller[] = [
  { productId: '1', productName: 'A', quantitySold: 5, revenue: 50 },
  { productId: '2', productName: 'B', quantitySold: 20, revenue: 40 },
  { productId: '3', productName: 'C', quantitySold: 10, revenue: 100 },
]

describe('rankBestSellers', () => {
  it('sorts by quantity sold descending', () => {
    expect(rankBestSellers(sample).map((r) => r.productId)).toEqual(['2', '3', '1'])
  })

  it('respects the limit', () => {
    expect(rankBestSellers(sample, 2)).toHaveLength(2)
  })
})
