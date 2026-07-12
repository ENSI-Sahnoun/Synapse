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

describe('celebration actions', () => {
  it('getUnseenCelebrationAction is defined', async () => {
    const { getUnseenCelebrationAction } = await import('./celebrations')
    expect(getUnseenCelebrationAction).toBeDefined()
  })

  it('markCelebrationsSeenAction is defined', async () => {
    const { markCelebrationsSeenAction } = await import('./celebrations')
    expect(markCelebrationsSeenAction).toBeDefined()
  })
})
