import { describe, it, expect, vi } from 'vitest'
import { extractPriceChange } from './price-history-helpers'

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

describe('getProductPriceHistory', () => {
  it('includes a product_create row (wrapped as { new }) with oldPrice null and the created price as newPrice', async () => {
    const rows = [
      {
        id: 'log-create',
        details: { new: { price_dt: 12.5, name: 'Coca' } },
        actor_id: 'user-1',
        created_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'log-update',
        details: { old: { price_dt: 12.5 }, new: { price_dt: 15 } },
        actor_id: 'user-1',
        created_at: '2026-02-01T00:00:00.000Z',
      },
    ]
    const orderMock = vi.fn(async () => ({ data: rows }))
    const inMock = vi.fn(() => ({ order: orderMock }))
    const eqMock = vi.fn(() => ({ in: inMock }))
    const selectMock = vi.fn(() => ({ eq: eqMock }))

    vi.doMock('@/supabase-clients/server', () => ({
      createSupabaseClient: vi.fn(async () => ({
        from: (table: string) => {
          if (table === 'pos_activity_log') return { select: selectMock }
          throw new Error(`unexpected table: ${table}`)
        },
      })),
    }))

    vi.resetModules()
    const { getProductPriceHistory } = await import('./price-history')
    const result = await getProductPriceHistory('product-1')

    expect(result).toEqual([
      {
        id: 'log-create',
        oldPrice: null,
        newPrice: 12.5,
        actorId: 'user-1',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'log-update',
        oldPrice: 12.5,
        newPrice: 15,
        actorId: 'user-1',
        createdAt: '2026-02-01T00:00:00.000Z',
      },
    ])
  })
})
