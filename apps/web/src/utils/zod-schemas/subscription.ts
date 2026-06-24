import { z } from 'zod'

export const createSubscriptionSchema = z.object({
  student_id: z.string().uuid('ID étudiant invalide'),
  plan_id: z.string().uuid('Formule invalide'),
  start_date: z.string().date().optional(),
})

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>

export const adminUpdateSubscriptionSchema = z.object({
  subscription_id: z.string().uuid(),
  end_date: z.string().date().optional(),
  plan_id: z.string().uuid().optional(),
  cancel: z.boolean().optional(),
})

export type AdminUpdateSubscriptionInput = z.infer<typeof adminUpdateSubscriptionSchema>
