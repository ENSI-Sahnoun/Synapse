import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/safe-action', () => ({
  employeeActionClient: {
    schema: vi.fn().mockReturnThis(),
    action: vi.fn().mockReturnValue(vi.fn()),
  },
}))

vi.mock('@/supabase-clients/server', () => ({
  createSupabaseClient: vi.fn(),
}))

describe('loyalty request actions', () => {
  it('fulfilRedemptionAction is defined', async () => {
    const { fulfilRedemptionAction } = await import('./loyalty-requests')
    expect(fulfilRedemptionAction).toBeDefined()
  })

  it('rejectRedemptionAction is defined', async () => {
    const { rejectRedemptionAction } = await import('./loyalty-requests')
    expect(rejectRedemptionAction).toBeDefined()
  })
})
