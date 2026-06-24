import { z } from 'zod'

export const createSubscriptionSchema = z.object({
  student_id: z.string().uuid('ID étudiant invalide'),
  plan_id: z.string().uuid('Formule invalide'),
  start_date: z.string().date().optional(),
})

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>
