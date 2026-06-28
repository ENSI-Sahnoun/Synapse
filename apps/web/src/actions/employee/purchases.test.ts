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

describe('createPurchaseAction', () => {
  it('is defined', async () => {
    const { createPurchaseAction } = await import('./purchases')
    expect(createPurchaseAction).toBeDefined()
  })
})
