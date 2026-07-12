import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/safe-action', () => ({
  studentActionClient: {
    schema: vi.fn().mockReturnThis(),
    action: vi.fn((fn) => fn),
  },
}))

type ActionArgs = { ctx: { userId: string } }
type ActionFn = (args: ActionArgs) => Promise<unknown>

describe('airdropQrCode', () => {
  it('throws when the caller has no qr_token', async () => {
    vi.doMock('@/supabase-clients/server', () => ({
      createSupabaseClient: vi.fn(async () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { full_name: 'Anis', qr_token: null } }),
            }),
          }),
        }),
      })),
    }))
    const notifyAllStaffNoPush = vi.fn()
    vi.doMock('@/data/notifications/inapp', () => ({ notifyAllStaffNoPush }))
    vi.resetModules()

    const { airdropQrCode } = await import('./airdrop-qr')
    await expect(
      (airdropQrCode as unknown as ActionFn)({ ctx: { userId: 'stu-1' } }),
    ).rejects.toThrow('Code QR indisponible.')
    expect(notifyAllStaffNoPush).not.toHaveBeenCalled()
  })

  it('calls notifyAllStaffNoPush with the student name and qr_token as link', async () => {
    vi.doMock('@/supabase-clients/server', () => ({
      createSupabaseClient: vi.fn(async () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { full_name: 'Anis Ben Ali', qr_token: 'SYNAPSE-abc-123' },
              }),
            }),
          }),
        }),
      })),
    }))
    const notifyAllStaffNoPush = vi.fn()
    vi.doMock('@/data/notifications/inapp', () => ({ notifyAllStaffNoPush }))
    vi.resetModules()

    const { airdropQrCode } = await import('./airdrop-qr')
    const result = await (airdropQrCode as unknown as ActionFn)({ ctx: { userId: 'stu-1' } })

    expect(notifyAllStaffNoPush).toHaveBeenCalledWith('qr_airdrop', 'Anis Ben Ali', {
      link: 'SYNAPSE-abc-123',
    })
    expect(result).toEqual({ success: true })
  })
})
