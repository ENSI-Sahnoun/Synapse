import { describe, it, expect, vi } from 'vitest'

// Unwrap next-safe-action so `.action(fn)` returns the raw handler.
vi.mock('@/lib/safe-action', () => ({
  studentActionClient: {
    schema: vi.fn().mockReturnThis(),
    action: vi.fn((fn) => fn),
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

describe('checkOutSelf', () => {
  it('is exported as an action', async () => {
    vi.doMock('@/supabase-clients/server', () => ({ createSupabaseClient: vi.fn() }))
    vi.doMock('@/supabase-clients/admin', () => ({ createSupabaseAdminClient: vi.fn() }))
    const mod = await import('./seat-swap')
    expect(mod.checkOutSelf).toBeInstanceOf(Function)
  })

  it('throws when the caller has no open attendance', async () => {
    // getMyOpenAttendance uses the server client; return no row.
    const serverClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            is: () => ({
              order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }),
            }),
          }),
        }),
      }),
    }
    vi.doMock('@/supabase-clients/server', () => ({
      createSupabaseClient: vi.fn(async () => serverClient),
    }))
    vi.doMock('@/supabase-clients/admin', () => ({ createSupabaseAdminClient: vi.fn() }))
    vi.resetModules()
    const { checkOutSelf } = await import('./seat-swap')
    await expect(
      (checkOutSelf as unknown as (a: { ctx: { userId: string } }) => Promise<unknown>)({
        ctx: { userId: 'stu-1' },
      }),
    ).rejects.toThrow("Vous n'êtes pas enregistré comme présent.")
  })
})
