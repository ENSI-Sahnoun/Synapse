import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/safe-action', () => ({
  adminActionClient: {
    schema: vi.fn().mockReturnThis(),
    action: vi.fn().mockReturnValue({}),
  },
}))

describe('subscription plan actions', () => {
  it('createPlanAction is defined', async () => {
    const { createPlanAction } = await import('./subscription-plans')
    expect(createPlanAction).toBeDefined()
  })

  it('togglePlanAction is defined', async () => {
    const { togglePlanAction } = await import('./subscription-plans')
    expect(togglePlanAction).toBeDefined()
  })
})
