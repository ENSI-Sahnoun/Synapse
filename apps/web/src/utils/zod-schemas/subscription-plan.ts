import { z } from 'zod'

export const createSubscriptionPlanSchema = z.object({
  name: z.string().min(2, 'Nom requis'),
  duration_days: z.coerce.number().int().min(1, 'Durée minimum 1 jour'),
  price_dt: z.coerce.number().min(0, 'Prix invalide'),
  tax_rate_pct: z.coerce.number().min(0).max(100).default(0),
})

export type CreateSubscriptionPlanInput = z.infer<typeof createSubscriptionPlanSchema>

export const updateSubscriptionPlanSchema = createSubscriptionPlanSchema.partial().extend({
  id: z.string().uuid(),
})

export const togglePlanSchema = z.object({
  id: z.string().uuid(),
  is_active: z.boolean(),
})
