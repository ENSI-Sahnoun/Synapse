import { describe, it, expect, vi } from 'vitest'

// Unwrap next-safe-action so `.action(fn)` returns the raw handler,
// letting tests invoke the action's core logic directly under mocks.
vi.mock('@/lib/safe-action', () => ({
  adminActionClient: {
    schema: vi.fn().mockReturnThis(),
    action: vi.fn((fn) => fn),
  },
}))

describe('product actions', () => {
  it('updateProductAction is defined', async () => {
    const { updateProductAction } = await import('./products')
    expect(updateProductAction).toBeDefined()
  })
})

describe('updateProductAction old/new price-change logging', () => {
  it('logs old values scoped to the updated keys and new values as the raw update payload', async () => {
    const insertMock = vi.fn(async () => ({ error: null }))
    const updateEqMock = vi.fn(async () => ({ error: null }))
    const supabaseAdmin = {
      from: (table: string) => {
        if (table === 'products') {
          return { update: () => ({ eq: updateEqMock }) }
        }
        if (table === 'pos_activity_log') {
          return { insert: insertMock }
        }
        throw new Error(`unexpected table: ${table}`)
      },
    }

    vi.doMock('@/supabase-clients/admin', () => ({
      createSupabaseAdminClient: vi.fn(() => supabaseAdmin),
    }))
    vi.doMock('@/data/admin/products', () => ({
      getProductById: vi.fn(async () => ({
        id: 'p1',
        name: 'Old Name',
        category: 'Snacks',
        price_dt: 5,
        cost_price: 2,
        supplier: null,
        barcode: null,
        stock_quantity: 100,
        is_active: true,
        image_url: null,
        created_at: '2026-01-01T00:00:00.000Z',
        sort_order: 0,
      })),
    }))
    vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }))
    vi.resetModules()

    const { updateProductAction } = await import('./products')

    type Handler = (args: {
      parsedInput: { id: string; price_dt: number; name: string }
      ctx: { userId: string }
    }) => Promise<unknown>

    await (updateProductAction as unknown as Handler)({
      parsedInput: { id: 'p1', price_dt: 8, name: 'New Name' },
      ctx: { userId: 'u1' },
    })

    expect(updateEqMock).toHaveBeenCalledWith('id', 'p1')
    expect(insertMock).toHaveBeenCalledTimes(1)

    const [payload] = insertMock.mock.calls[0] as [
      { action: string; product_id: string; actor_id: string; details: { old: Record<string, unknown>; new: Record<string, unknown> } },
    ]

    expect(payload.action).toBe('product_update')
    expect(payload.product_id).toBe('p1')
    expect(payload.actor_id).toBe('u1')

    // `old` must reflect the pre-update values, scoped to only the keys being updated.
    expect(payload.details.old).toEqual({ price_dt: 5, name: 'Old Name' })
    expect(payload.details.old).not.toHaveProperty('stock_quantity')
    expect(payload.details.old).not.toHaveProperty('cost_price')

    // `new` must reflect the update payload actually applied.
    expect(payload.details.new).toEqual({ price_dt: 8, name: 'New Name' })
  })
})
