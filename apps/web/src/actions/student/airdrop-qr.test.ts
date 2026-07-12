import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/safe-action', () => ({
  studentActionClient: {
    schema: vi.fn().mockReturnThis(),
    action: vi.fn((fn) => fn),
  },
}))

type ActionArgs = { ctx: { userId: string } }
type ActionFn = (args: ActionArgs) => Promise<unknown>

function mockServerClient(profile: { full_name: string; qr_token: string | null }) {
  return {
    createSupabaseClient: vi.fn(async () => ({
      from: (table: string) => {
        if (table === 'profiles') {
          return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }) }
        }
        if (table === 'attendance') {
          return {
            select: () => ({
              eq: () => ({
                is: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({ data: { seat_id: 'seat-1' } }),
                    }),
                  }),
                }),
              }),
            }),
          }
        }
        throw new Error(`unexpected table ${table}`)
      },
    })),
  }
}

function mockAdminClient(roomId: string | null) {
  return {
    createSupabaseAdminClient: vi.fn(() => ({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { room_id: roomId } }) }) }) }),
    })),
  }
}

describe('airdropQrCode', () => {
  it('throws when the caller has no qr_token', async () => {
    vi.doMock('@/supabase-clients/server', () => mockServerClient({ full_name: 'Anis', qr_token: null }))
    vi.doMock('@/supabase-clients/admin', () => mockAdminClient('room-1'))
    const notifyAllStaffNoPush = vi.fn()
    vi.doMock('@/data/notifications/inapp', () => ({ notifyAllStaffNoPush }))
    vi.resetModules()

    const { airdropQrCode } = await import('./airdrop-qr')
    await expect(
      (airdropQrCode as unknown as ActionFn)({ ctx: { userId: 'stu-1' } }),
    ).rejects.toThrow('Code QR indisponible.')
    expect(notifyAllStaffNoPush).not.toHaveBeenCalled()
  })

  it('throws when the student is not seated in a room', async () => {
    vi.doMock('@/supabase-clients/server', () =>
      mockServerClient({ full_name: 'Anis Ben Ali', qr_token: 'SYNAPSE-abc-123' }),
    )
    vi.doMock('@/supabase-clients/admin', () => mockAdminClient(null))
    const notifyAllStaffNoPush = vi.fn()
    vi.doMock('@/data/notifications/inapp', () => ({ notifyAllStaffNoPush }))
    vi.resetModules()

    const { airdropQrCode } = await import('./airdrop-qr')
    await expect(
      (airdropQrCode as unknown as ActionFn)({ ctx: { userId: 'stu-1' } }),
    ).rejects.toThrow('Vous devez être présent dans une salle pour envoyer votre code.')
    expect(notifyAllStaffNoPush).not.toHaveBeenCalled()
  })

  it('calls notifyAllStaffNoPush with the student name and qr_token as link', async () => {
    vi.doMock('@/supabase-clients/server', () =>
      mockServerClient({ full_name: 'Anis Ben Ali', qr_token: 'SYNAPSE-abc-123' }),
    )
    vi.doMock('@/supabase-clients/admin', () => mockAdminClient('room-1'))
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
