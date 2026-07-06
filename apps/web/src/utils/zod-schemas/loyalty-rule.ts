import { z } from 'zod'

export const REWARD_TYPES = ['free_day', 'free_coffee', 'discount_pct'] as const
export type RewardType = typeof REWARD_TYPES[number]

export const createLoyaltyRuleSchema = z.object({
  name: z.string().min(2, 'Nom requis'),
  reward_type: z.enum(REWARD_TYPES, { error: 'Type de récompense invalide' }),
  points_threshold: z.coerce.number().int().min(1, 'Seuil minimum 1 point'),
  reward_value: z.coerce.number().min(0, 'Valeur invalide').default(0),
  redemption_cost_dt: z.coerce.number().min(0, 'Coût invalide').default(0),
})

export type CreateLoyaltyRuleInput = z.infer<typeof createLoyaltyRuleSchema>

export const updateLoyaltyRuleSchema = createLoyaltyRuleSchema.partial().extend({
  id: z.string().uuid(),
})

export const toggleLoyaltyRuleSchema = z.object({
  id: z.string().uuid(),
  is_active: z.boolean(),
})
