import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/safe-action', () => ({
  adminActionClient: {
    schema: vi.fn().mockReturnThis(),
    action: vi.fn().mockReturnValue({}),
  },
}))

describe('transaction correction actions', () => {
  it('exports all five actions', async () => {
    const mod = await import('./transactions')
    expect(mod.editPurchaseItemAction).toBeDefined()
    expect(mod.voidPurchaseAction).toBeDefined()
    expect(mod.editSubscriptionAction).toBeDefined()
    expect(mod.voidSubscriptionAction).toBeDefined()
    expect(mod.voidChargeAction).toBeDefined()
  })
})
