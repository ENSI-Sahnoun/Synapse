import { describe, it, expect } from 'vitest'
import { createLoyaltyRuleSchema } from './loyalty-rule'

describe('createLoyaltyRuleSchema', () => {
  it('passes valid free_day rule', () => {
    const result = createLoyaltyRuleSchema.safeParse({
      name: 'Journée gratuite',
      reward_type: 'free_day',
      points_threshold: 70,
      reward_value: 0,
    })
    expect(result.success).toBe(true)
  })

  it('passes valid discount_pct rule', () => {
    const result = createLoyaltyRuleSchema.safeParse({
      name: 'Réduction 10%',
      reward_type: 'discount_pct',
      points_threshold: 50,
      reward_value: 10,
    })
    expect(result.success).toBe(true)
  })

  it('coerces string numbers', () => {
    const result = createLoyaltyRuleSchema.safeParse({
      name: 'Café offert',
      reward_type: 'free_coffee',
      points_threshold: '30',
      reward_value: '0',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.points_threshold).toBe(30)
    }
  })

  it('rejects invalid reward_type', () => {
    const result = createLoyaltyRuleSchema.safeParse({
      name: 'Test',
      reward_type: 'mystery_box',
      points_threshold: 10,
      reward_value: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects zero threshold', () => {
    const result = createLoyaltyRuleSchema.safeParse({
      name: 'Test',
      reward_type: 'free_day',
      points_threshold: 0,
      reward_value: 0,
    })
    expect(result.success).toBe(false)
  })
})
