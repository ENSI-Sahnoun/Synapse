import { z } from 'zod'

export const editPurchaseItemSchema = z.object({
  item_id: z.string().uuid(),
  quantity: z.coerce.number().int().min(1, 'Quantité minimum 1'),
  product_id: z.string().uuid(),
})

export const voidPurchaseSchema = z.object({
  purchase_id: z.string().uuid(),
})

export const editSubscriptionSchema = z.object({
  subscription_id: z.string().uuid(),
  plan_id: z.string().uuid(),
})

export const voidSubscriptionSchema = z.object({
  subscription_id: z.string().uuid(),
})

export const voidChargeSchema = z.object({
  activity_log_id: z.string().uuid(),
})

export type EditPurchaseItemInput = z.infer<typeof editPurchaseItemSchema>
export type EditSubscriptionInput = z.infer<typeof editSubscriptionSchema>
