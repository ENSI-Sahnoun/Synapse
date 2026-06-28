import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/safe-action', () => ({
  studentActionClient: {
    schema: vi.fn().mockReturnThis(),
    action: vi.fn().mockReturnValue(vi.fn()),
  },
}))

vi.mock('@/supabase-clients/server', () => ({
  createSupabaseClient: vi.fn(),
}))

describe('requestRedemptionAction', () => {
  it('is defined', async () => {
    const { requestRedemptionAction } = await import('./request-redemption')
    expect(requestRedemptionAction).toBeDefined()
  })
})
