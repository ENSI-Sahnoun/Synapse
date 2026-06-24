import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/safe-action', () => ({
  actionClient: {
    schema: vi.fn().mockReturnThis(),
    action: vi.fn().mockReturnValue({}),
  },
}))

vi.mock('@/supabase-clients/server', () => ({
  createSupabaseClient: vi.fn(),
}))

describe('studentSignupAction', () => {
  it('is defined', async () => {
    const { studentSignupAction } = await import('./student-signup')
    expect(studentSignupAction).toBeDefined()
  })
})
