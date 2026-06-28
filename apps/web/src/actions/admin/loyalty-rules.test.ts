import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/safe-action', () => ({
  adminActionClient: {
    schema: vi.fn().mockReturnThis(),
    action: vi.fn().mockReturnValue({}),
  },
}))

vi.mock('@/supabase-clients/server', () => ({
  createSupabaseClient: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

describe('loyalty rule actions', () => {
  it('createLoyaltyRuleAction is defined', async () => {
    const { createLoyaltyRuleAction } = await import('./loyalty-rules')
    expect(createLoyaltyRuleAction).toBeDefined()
  })

  it('updateLoyaltyRuleAction is defined', async () => {
    const { updateLoyaltyRuleAction } = await import('./loyalty-rules')
    expect(updateLoyaltyRuleAction).toBeDefined()
  })

  it('toggleLoyaltyRuleAction is defined', async () => {
    const { toggleLoyaltyRuleAction } = await import('./loyalty-rules')
    expect(toggleLoyaltyRuleAction).toBeDefined()
  })
})
