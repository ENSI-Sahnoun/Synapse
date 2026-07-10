import { describe, it, expect, vi, beforeEach } from 'vitest'

const insertMock = vi.fn(async () => ({ error: null }))
const maybeSingleMock = vi.fn(async () => ({ data: { is_enabled: true } }))
const staffSelectMock = vi.fn(async () => ({ data: [{ id: 'staff-1' }] }))

vi.mock('@/supabase-clients/admin', () => ({
  createSupabaseAdminClient: () => ({
    from: (table: string) => {
      if (table === 'profiles') {
        return { select: () => ({ in: staffSelectMock }) }
      }
      if (table === 'notification_channel_config') {
        return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }) }) }
      }
      if (table === 'notifications') {
        return { insert: insertMock }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }),
}))

vi.mock('@/lib/notifications/push', () => ({ sendPushToUsers: vi.fn(async () => {}) }))

beforeEach(() => {
  insertMock.mockClear()
  maybeSingleMock.mockClear()
})

describe('notifyAllStaff', () => {
  it('inserts a row per staff member including the link when enabled', async () => {
    const { notifyAllStaff } = await import('./inapp')
    await notifyAllStaff('reservation_new', 'Fatma Ben Ali a réservé la place A12.', {
      link: '/employee/reservations?highlight=res-1',
    })
    expect(insertMock).toHaveBeenCalledWith([
      {
        user_id: 'staff-1',
        type: 'reservation_new',
        message: 'Fatma Ben Ali a réservé la place A12.',
        link: '/employee/reservations?highlight=res-1',
      },
    ])
  })

  it('skips the insert when in-app is disabled for the type', async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: { is_enabled: false } })
    vi.resetModules()
    const { notifyAllStaff: fresh } = await import('./inapp')
    await fresh('reservation_new', 'message')
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('treats a missing config row as enabled (default true)', async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null })
    vi.resetModules()
    const { notifyAllStaff: fresh } = await import('./inapp')
    await fresh('reservation_new', 'message')
    expect(insertMock).toHaveBeenCalled()
  })
})
