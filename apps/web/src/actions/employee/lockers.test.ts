import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/safe-action', () => ({
  employeeActionClient: {
    schema: vi.fn().mockReturnThis(),
    action: vi.fn().mockReturnValue({}),
  },
}))

vi.mock('@/supabase-clients/server', () => ({
  createSupabaseClient: vi.fn(),
}))

vi.mock('@/data/employee/lockers', () => ({
  getActiveEligibleSubscriptionId: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

describe('locker actions', () => {
  it('are all defined', async () => {
    const {
      assignLockerAction,
      unassignLockerAction,
      markLockerUnavailableAction,
      markLockerAvailableAction,
    } = await import('./lockers')
    expect(assignLockerAction).toBeDefined()
    expect(unassignLockerAction).toBeDefined()
    expect(markLockerUnavailableAction).toBeDefined()
    expect(markLockerAvailableAction).toBeDefined()
  })
})
