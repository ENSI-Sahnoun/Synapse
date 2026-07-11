import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/safe-action', () => ({
  employeeActionClient: {
    schema: vi.fn().mockReturnThis(),
    action: vi.fn((fn) => fn),
  },
}))

type ActionArgs = { parsedInput: { studentId: string } }
type ActionFn = (args: ActionArgs) => Promise<unknown>

describe('dropQrToKiosk', () => {
  it('throws when the student has no qr_token', async () => {
    vi.doMock('@/supabase-clients/server', () => ({
      createSupabaseClient: vi.fn(async () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { full_name: 'Aziz Mehdi', qr_token: null } }),
              }),
            }),
          }),
        }),
      })),
    }))
    const notifyAllStaffNoPush = vi.fn()
    vi.doMock('@/data/notifications/inapp', () => ({ notifyAllStaffNoPush }))
    vi.resetModules()

    const { dropQrToKiosk } = await import('./kiosk-qr-drop')
    await expect(
      (dropQrToKiosk as unknown as ActionFn)({ parsedInput: { studentId: 'stu-1' } }),
    ).rejects.toThrow('Étudiant introuvable ou code QR indisponible.')
    expect(notifyAllStaffNoPush).not.toHaveBeenCalled()
  })

  it('calls notifyAllStaffNoPush with the student name, qr_token, and studentId', async () => {
    vi.doMock('@/supabase-clients/server', () => ({
      createSupabaseClient: vi.fn(async () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { full_name: 'Aziz Mehdi', qr_token: 'SYNAPSE-xyz-789' },
                }),
              }),
            }),
          }),
        }),
      })),
    }))
    const notifyAllStaffNoPush = vi.fn()
    vi.doMock('@/data/notifications/inapp', () => ({ notifyAllStaffNoPush }))
    vi.resetModules()

    const { dropQrToKiosk } = await import('./kiosk-qr-drop')
    const result = await (dropQrToKiosk as unknown as ActionFn)({ parsedInput: { studentId: 'stu-1' } })

    expect(notifyAllStaffNoPush).toHaveBeenCalledWith('kiosk_qr_drop', 'Aziz Mehdi', {
      link: 'SYNAPSE-xyz-789',
      studentId: 'stu-1',
    })
    expect(result).toEqual({ success: true })
  })
})

describe('cancelKioskQrDrop', () => {
  it('calls notifyAllStaffNoPush with the kiosk_qr_drop_cancel type', async () => {
    const notifyAllStaffNoPush = vi.fn()
    vi.doMock('@/data/notifications/inapp', () => ({ notifyAllStaffNoPush }))
    vi.resetModules()

    const { cancelKioskQrDrop } = await import('./kiosk-qr-drop')
    const result = await (cancelKioskQrDrop as unknown as ActionFn)({ parsedInput: { studentId: 'stu-1' } })

    expect(notifyAllStaffNoPush).toHaveBeenCalledWith('kiosk_qr_drop_cancel', 'Diffusion arrêtée', {
      studentId: 'stu-1',
    })
    expect(result).toEqual({ success: true })
  })
})
