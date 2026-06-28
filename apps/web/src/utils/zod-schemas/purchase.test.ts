import { describe, it, expect } from 'vitest'
import { createPurchaseSchema } from './purchase'

describe('createPurchaseSchema', () => {
  it('passes valid anonymous purchase', () => {
    const result = createPurchaseSchema.safeParse({
      student_id: null,
      items: [{ product_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', quantity: 2, unit_price_dt: 3 }],
    })
    expect(result.success).toBe(true)
  })

  it('passes valid purchase with student', () => {
    const result = createPurchaseSchema.safeParse({
      student_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      items: [{ product_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', quantity: 1, unit_price_dt: 5 }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty items array', () => {
    const result = createPurchaseSchema.safeParse({
      student_id: null,
      items: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects zero quantity', () => {
    const result = createPurchaseSchema.safeParse({
      student_id: null,
      items: [{ product_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', quantity: 0, unit_price_dt: 3 }],
    })
    expect(result.success).toBe(false)
  })

  it('coerces string quantity', () => {
    const result = createPurchaseSchema.safeParse({
      student_id: null,
      items: [{ product_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', quantity: '3', unit_price_dt: '2.5' }],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.items[0].quantity).toBe(3)
    }
  })
})
