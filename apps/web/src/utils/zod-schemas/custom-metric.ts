import { z } from 'zod'

export const createCustomMetricSchema = z.object({
  name: z.string().min(2, 'Nom requis').max(100),
  unit: z.string().max(20).default(''),
  target_value: z.coerce.number().positive('La cible doit être positive').optional(),
  is_dashboard_visible: z.boolean().default(true),
})

export type CreateCustomMetricInput = z.infer<typeof createCustomMetricSchema>

export const updateCustomMetricSchema = createCustomMetricSchema.partial().extend({
  id: z.string().uuid(),
})

export const deleteCustomMetricSchema = z.object({
  id: z.string().uuid(),
})
