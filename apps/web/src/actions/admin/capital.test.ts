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

describe('capital actions', () => {
  it('are defined', async () => {
    const { recordCapitalMovementAction, recordCapitalTransferAction } = await import('./capital')
    expect(recordCapitalMovementAction).toBeDefined()
    expect(recordCapitalTransferAction).toBeDefined()
  })
})
