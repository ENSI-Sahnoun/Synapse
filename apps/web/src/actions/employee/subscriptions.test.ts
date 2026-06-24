import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/safe-action', () => ({
  employeeActionClient: {
    schema: vi.fn().mockReturnThis(),
    action: vi.fn().mockReturnValue({}),
  },
}))

vi.mock('@/supabase-clients/server', () => ({
  createSupabaseClient: vi.fn(),
}))

describe('createSubscriptionAction', () => {
  it('is defined', async () => {
    const { createSubscriptionAction } = await import('./subscriptions')
    expect(createSubscriptionAction).toBeDefined()
  })
})
