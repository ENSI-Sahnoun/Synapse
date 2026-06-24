import { describe, it, expect } from 'vitest'
import { createSubscriptionPlanSchema } from './subscription-plan'

describe('createSubscriptionPlanSchema', () => {
  it('passes valid plan', () => {
    const result = createSubscriptionPlanSchema.safeParse({
      name: 'Mensuel',
      duration_days: 30,
      price_dt: 70,
    })
    expect(result.success).toBe(true)
  })

  it('coerces string numbers', () => {
    const result = createSubscriptionPlanSchema.safeParse({
      name: 'Journalier',
      duration_days: '1',
      price_dt: '6',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.duration_days).toBe(1)
      expect(result.data.price_dt).toBe(6)
    }
  })

  it('rejects zero duration', () => {
    const result = createSubscriptionPlanSchema.safeParse({ name: 'Test', duration_days: 0, price_dt: 10 })
    expect(result.success).toBe(false)
  })
})
