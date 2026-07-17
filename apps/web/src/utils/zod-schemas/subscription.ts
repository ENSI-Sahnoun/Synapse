import { z } from 'zod'

export const createSubscriptionSchema = z.object({
  student_id: z.string().uuid('ID étudiant invalide'),
  plan_id: z.string().uuid('Formule invalide'),
  start_date: z.string().date().optional(),
})

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>

export const updateSubscriptionSchema = z.object({
  subscription_id: z.string().uuid(),
  start_date: z.string().date().optional(),
  end_date: z.string().date().optional(),
  plan_id: z.string().uuid().optional(),
  cancel: z.boolean().optional(),
})

export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>

export const deleteSubscriptionSchema = z.object({
  subscription_id: z.string().uuid(),
})

export type DeleteSubscriptionInput = z.infer<typeof deleteSubscriptionSchema>

export const adjustLoyaltyPointsSchema = z.object({
  student_id: z.string().uuid(),
  points_delta: z.number().int().refine((n) => n !== 0, 'Le montant ne peut pas être nul'),
})

export type AdjustLoyaltyPointsInput = z.infer<typeof adjustLoyaltyPointsSchema>
