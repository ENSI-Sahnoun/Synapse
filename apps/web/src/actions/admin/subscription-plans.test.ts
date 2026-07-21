import { describe, it, expect, vi } from 'vitest'

// Unwrap next-safe-action so `.action(fn)` returns the raw handler,
// letting these tests invoke the action's core logic directly under mocks.
vi.mock('@/lib/safe-action', () => ({
  adminActionClient: {
    schema: vi.fn().mockReturnThis(),
    action: vi.fn((fn) => fn),
  },
}))

describe('subscription plan actions', () => {
  it('createPlanAction is defined', async () => {
    const { createPlanAction } = await import('./subscription-plans')
    expect(createPlanAction).toBeDefined()
  })

  it('togglePlanAction is defined', async () => {
    const { togglePlanAction } = await import('./subscription-plans')
    expect(togglePlanAction).toBeDefined()
  })
})

describe('createPlanAction plan_create logging', () => {
  it('inserts a subscription_plan_activity_log row with the new plan payload', async () => {
    const insertLogMock = vi.fn(async () => ({ error: null }))
    const singleMock = vi.fn(async () => ({ data: { id: 'plan1', name: 'Gold', price_dt: 100 }, error: null }))
    const supabase = {
      from: (table: string) => {
        if (table === 'subscription_plans') {
          return { insert: () => ({ select: () => ({ single: singleMock }) }) }
        }
        throw new Error(`unexpected table: ${table}`)
      },
    }
    const supabaseAdmin = {
      from: (table: string) => {
        if (table === 'subscription_plan_activity_log') {
          return { insert: insertLogMock }
        }
        throw new Error(`unexpected table: ${table}`)
      },
    }

    vi.doMock('@/supabase-clients/server', () => ({
      createSupabaseClient: vi.fn(async () => supabase),
    }))
    vi.doMock('@/supabase-clients/admin', () => ({
      createSupabaseAdminClient: vi.fn(() => supabaseAdmin),
    }))
    vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }))
    vi.resetModules()

    const { createPlanAction } = await import('./subscription-plans')

    type Handler = (args: {
      parsedInput: { name: string; price_dt: number; duration_days: number }
      ctx: { userId: string }
    }) => Promise<unknown>

    await (createPlanAction as unknown as Handler)({
      parsedInput: { name: 'Gold', price_dt: 100, duration_days: 30 },
      ctx: { userId: 'u1' },
    })

    expect(insertLogMock).toHaveBeenCalledTimes(1)
    const [payload] = insertLogMock.mock.calls[0] as unknown as [
      { action: string; plan_id: string; actor_id: string; details: { new: Record<string, unknown> } },
    ]
    expect(payload.action).toBe('plan_create')
    expect(payload.plan_id).toBe('plan1')
    expect(payload.actor_id).toBe('u1')
    expect(payload.details.new).toEqual({ name: 'Gold', price_dt: 100, duration_days: 30 })
  })
})

describe('updatePlanAction plan_update old/new price-change logging', () => {
  it('logs old values scoped to the updated keys and new values as the raw update payload', async () => {
    const insertLogMock = vi.fn(async () => ({ error: null }))
    const updateEqMock = vi.fn(async () => ({ error: null }))
    const singleMock = vi.fn(async () => ({
      data: { id: 'plan1', name: 'Old Name', price_dt: 100, duration_days: 30 },
    }))
    const supabase = {
      from: (table: string) => {
        if (table === 'subscription_plans') {
          return {
            select: () => ({ eq: () => ({ single: singleMock }) }),
            update: () => ({ eq: updateEqMock }),
          }
        }
        throw new Error(`unexpected table: ${table}`)
      },
    }
    const supabaseAdmin = {
      from: (table: string) => {
        if (table === 'subscription_plan_activity_log') {
          return { insert: insertLogMock }
        }
        throw new Error(`unexpected table: ${table}`)
      },
    }

    vi.doMock('@/supabase-clients/server', () => ({
      createSupabaseClient: vi.fn(async () => supabase),
    }))
    vi.doMock('@/supabase-clients/admin', () => ({
      createSupabaseAdminClient: vi.fn(() => supabaseAdmin),
    }))
    vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }))
    vi.resetModules()

    const { updatePlanAction } = await import('./subscription-plans')

    type Handler = (args: {
      parsedInput: { id: string; price_dt: number; name: string }
      ctx: { userId: string }
    }) => Promise<unknown>

    await (updatePlanAction as unknown as Handler)({
      parsedInput: { id: 'plan1', price_dt: 150, name: 'New Name' },
      ctx: { userId: 'u1' },
    })

    expect(updateEqMock).toHaveBeenCalledWith('id', 'plan1')
    expect(insertLogMock).toHaveBeenCalledTimes(1)

    const [payload] = insertLogMock.mock.calls[0] as unknown as [
      { action: string; plan_id: string; actor_id: string; details: { old: Record<string, unknown>; new: Record<string, unknown> } },
    ]

    expect(payload.action).toBe('plan_update')
    expect(payload.plan_id).toBe('plan1')
    expect(payload.actor_id).toBe('u1')

    // `old` must reflect the pre-update values, scoped to only the keys being updated.
    expect(payload.details.old).toEqual({ price_dt: 100, name: 'Old Name' })
    expect(payload.details.old).not.toHaveProperty('duration_days')

    // `new` must reflect the update payload actually applied.
    expect(payload.details.new).toEqual({ price_dt: 150, name: 'New Name' })
  })
})
