import { z } from 'zod'

export const handleRedemptionRequestSchema = z.object({
  request_id: z.string().uuid('ID de demande invalide'),
})

export type HandleRedemptionRequestInput = z.infer<typeof handleRedemptionRequestSchema>
