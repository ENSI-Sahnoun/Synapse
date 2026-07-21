import { z } from 'zod'

export const ACHIEVEMENT_CATEGORIES = [
  'visits',
  'hours',
  'spend',
  'purchase_count',
  'streak',
  'manual',
] as const
export type AchievementCategory = typeof ACHIEVEMENT_CATEGORIES[number]

export const createAchievementSchema = z
  .object({
    category: z.enum(ACHIEVEMENT_CATEGORIES, { error: 'Catégorie invalide' }),
    threshold: z.coerce.number().int().min(1, 'Seuil minimum 1').nullable().optional(),
    points: z.coerce.number().int().min(0, 'Points minimum 0'),
    title: z.string().min(2, 'Titre requis'),
    description: z.string().optional(),
    emoji: z.string().default('🏆'),
    sort_order: z.coerce.number().int().default(0),
  })
  .superRefine((data, ctx) => {
    if (data.category === 'manual') {
      if (data.threshold !== null && data.threshold !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['threshold'],
          message: 'Le seuil doit être null pour les succès manuels',
        })
      }
    } else {
      if (data.threshold === null || data.threshold === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['threshold'],
          message: 'Le seuil est requis',
        })
      }
    }
  })

export type CreateAchievementInput = z.infer<typeof createAchievementSchema>

export const updateAchievementSchema = createAchievementSchema.partial().extend({
  id: z.string().uuid(),
})

export type UpdateAchievementInput = z.infer<typeof updateAchievementSchema>

export const toggleAchievementSchema = z.object({
  id: z.string().uuid(),
  is_active: z.boolean(),
})

export type ToggleAchievementInput = z.infer<typeof toggleAchievementSchema>

export const createLevelSchema = z.object({
  level: z.coerce.number().int().min(1, 'Niveau minimum 1'),
  xp_required: z.coerce.number().int().min(0, 'XP minimum 0'),
  label: z.string().optional(),
})

export type CreateLevelInput = z.infer<typeof createLevelSchema>

export const updateLevelSchema = z.object({
  level: z.coerce.number().int().min(1, 'Niveau minimum 1'),
  xp_required: z.coerce.number().int().min(0, 'XP minimum 0'),
  label: z.string().optional(),
})

export type UpdateLevelInput = z.infer<typeof updateLevelSchema>

export const deleteLevelSchema = z.object({
  level: z.coerce.number().int().min(1, 'Niveau minimum 1'),
})

export type DeleteLevelInput = z.infer<typeof deleteLevelSchema>
