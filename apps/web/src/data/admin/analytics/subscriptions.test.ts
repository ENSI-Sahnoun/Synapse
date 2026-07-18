import { describe, it, expect, vi } from 'vitest'
import { classifySubscriptionStatus, plansChangedSince } from './subscriptions'

describe('classifySubscriptionStatus', () => {
  it('is expired when end_date is before today', () => {
    expect(classifySubscriptionStatus('2026-06-01', '2026-07-04')).toBe('expired')
  })

  it('is expiring_soon when end_date is within 7 days', () => {
    expect(classifySubscriptionStatus('2026-07-08', '2026-07-04')).toBe('expiring_soon')
  })

  it('is active when end_date is more than 7 days out', () => {
    expect(classifySubscriptionStatus('2026-08-01', '2026-07-04')).toBe('active')
  })

  it('treats end_date equal to today as expiring_soon, not expired', () => {
    expect(classifySubscriptionStatus('2026-07-04', '2026-07-04')).toBe('expiring_soon')
  })
})

describe('plansChangedSince', () => {
  it('returns true when a log row for the plan is after the given timestamp and price actually changed', () => {
    const rows = [
      {
        plan_id: 'p1',
        created_at: '2026-07-10T00:00:00Z',
        details: { old: { price_dt: 100 }, new: { price_dt: 120 } },
      },
    ]
    const changed = plansChangedSince(rows)
    expect(changed('p1', '2026-07-05T00:00:00Z')).toBe(true)
  })

  it('returns false when the only log row is before the given timestamp', () => {
    const rows = [
      {
        plan_id: 'p1',
        created_at: '2026-07-01T00:00:00Z',
        details: { old: { price_dt: 100 }, new: { price_dt: 120 } },
      },
    ]
    const changed = plansChangedSince(rows)
    expect(changed('p1', '2026-07-05T00:00:00Z')).toBe(false)
  })

  it('returns false for a plan with no log rows', () => {
    const rows: { plan_id: string | null; created_at: string; details: unknown }[] = []
    const changed = plansChangedSince(rows)
    expect(changed('p1', '2026-07-05T00:00:00Z')).toBe(false)
  })

  it('ignores rows with a null plan_id', () => {
    const rows = [
      {
        plan_id: null,
        created_at: '2026-07-10T00:00:00Z',
        details: { old: { price_dt: 100 }, new: { price_dt: 120 } },
      },
    ]
    const changed = plansChangedSince(rows)
    expect(changed('p1', '2026-07-05T00:00:00Z')).toBe(false)
  })

  it('does NOT count a plan_update row that only changed the name (no price change) as a price change', () => {
    // Reproduces the bug: editing name/duration/tax_rate logs a plan_update row too,
    // but it must not exclude subscriptions sold under this plan from the discount stat.
    const rows = [
      {
        plan_id: 'p1',
        created_at: '2026-07-10T00:00:00Z',
        details: { old: { name: 'Basic' }, new: { name: 'Basic Plan' } },
      },
    ]
    const changed = plansChangedSince(rows)
    expect(changed('p1', '2026-07-05T00:00:00Z')).toBe(false)
  })

  it('does NOT count a plan_update row where old.price_dt === new.price_dt', () => {
    const rows = [
      {
        plan_id: 'p1',
        created_at: '2026-07-10T00:00:00Z',
        details: { old: { price_dt: 100, name: 'Basic' }, new: { price_dt: 100, name: 'Basic Plan' } },
      },
    ]
    const changed = plansChangedSince(rows)
    expect(changed('p1', '2026-07-05T00:00:00Z')).toBe(false)
  })

  it('DOES count a plan_update row where price_dt actually changed, even alongside other field changes', () => {
    const rows = [
      {
        plan_id: 'p1',
        created_at: '2026-07-10T00:00:00Z',
        details: { old: { price_dt: 100, name: 'Basic' }, new: { price_dt: 150, name: 'Basic Plan' } },
      },
    ]
    const changed = plansChangedSince(rows)
    expect(changed('p1', '2026-07-05T00:00:00Z')).toBe(true)
  })
})

describe('getAvgDiscount', () => {
  it('does not exclude subscriptions from a plan whose only plan_update row changed the name, not the price', async () => {
    const subscriptionRows = [
      {
        plan_id: 'p1',
        paid_amount: 80,
        created_at: '2026-07-15T00:00:00Z',
        subscription_plans: { price_dt: 100 },
      },
    ]
    const logRows = [
      {
        plan_id: 'p1',
        created_at: '2026-07-16T00:00:00Z', // after the subscription's created_at
        details: { old: { name: 'Basic' }, new: { name: 'Basic Plan' } },
      },
    ]

    const subscriptionsQuery = {
      select: vi.fn(() => subscriptionsQuery),
      gte: vi.fn(() => subscriptionsQuery),
      lte: vi.fn(() => subscriptionsQuery),
      is: vi.fn(async () => ({ data: subscriptionRows })),
    }
    const logQuery = {
      select: vi.fn(() => logQuery),
      eq: vi.fn(async () => ({ data: logRows })),
    }

    vi.doMock('@/supabase-clients/server', () => ({
      createSupabaseClient: vi.fn(async () => ({
        from: (table: string) => {
          if (table === 'subscriptions') return subscriptionsQuery
          if (table === 'subscription_plan_activity_log') return logQuery
          throw new Error(`unexpected table: ${table}`)
        },
      })),
    }))

    vi.resetModules()
    const { getAvgDiscount } = await import('./subscriptions')
    const result = await getAvgDiscount({ from: '2026-07-01', to: '2026-07-31' })

    // Before the fix, the plan_update row (logged for the name edit) would wrongly
    // exclude this subscription, yielding avgDiscount 0 instead of the real 20.
    expect(result).toEqual({ avgDiscount: 20, avgDiscountPct: 20 })

    vi.doUnmock('@/supabase-clients/server')
  })
})
