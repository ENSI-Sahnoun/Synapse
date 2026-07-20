import { describe, it, expect } from 'vitest'
import {
  editPurchaseItemSchema,
  voidPurchaseSchema,
  editSubscriptionSchema,
  voidSubscriptionSchema,
  voidChargeSchema,
} from './transaction-correction'

const uuid = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

describe('transaction correction schemas', () => {
  it('editPurchaseItemSchema accepts valid input', () => {
    expect(editPurchaseItemSchema.safeParse({ item_id: uuid, quantity: 2, product_id: uuid }).success).toBe(true)
  })
  it('editPurchaseItemSchema rejects zero quantity', () => {
    expect(editPurchaseItemSchema.safeParse({ item_id: uuid, quantity: 0, product_id: uuid }).success).toBe(false)
  })
  it('voidPurchaseSchema accepts valid input', () => {
    expect(voidPurchaseSchema.safeParse({ purchase_id: uuid }).success).toBe(true)
  })
  it('editSubscriptionSchema accepts valid input', () => {
    expect(editSubscriptionSchema.safeParse({ subscription_id: uuid, plan_id: uuid }).success).toBe(true)
  })
  it('voidSubscriptionSchema accepts valid input', () => {
    expect(voidSubscriptionSchema.safeParse({ subscription_id: uuid }).success).toBe(true)
  })
  it('voidChargeSchema accepts valid input', () => {
    expect(voidChargeSchema.safeParse({ activity_log_id: uuid }).success).toBe(true)
  })
})
