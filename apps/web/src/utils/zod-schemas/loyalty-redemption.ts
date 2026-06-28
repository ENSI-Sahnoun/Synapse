import { z } from 'zod'

export const requestRedemptionSchema = z.object({
  rule_id: z.string().uuid('Règle invalide'),
})

export type RequestRedemptionInput = z.infer<typeof requestRedemptionSchema>
