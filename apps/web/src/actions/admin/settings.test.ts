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

describe('setNavOrder action', () => {
  it('is defined', async () => {
    const { setNavOrder } = await import('./settings')
    expect(setNavOrder).toBeDefined()
  })
})
