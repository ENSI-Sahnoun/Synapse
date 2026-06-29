import { z } from 'zod'

export const createAccountCategorySchema = z.object({
  type: z.enum(['income', 'expense'], { required_error: 'Type requis' }),
  name: z.string().min(2, 'Nom requis (2 caractères minimum)').max(100),
  description: z.string().max(255).optional(),
})

export type CreateAccountCategoryInput = z.infer<typeof createAccountCategorySchema>

export const updateAccountCategorySchema = createAccountCategorySchema.partial().extend({
  id: z.string().uuid(),
})

export const toggleAccountCategorySchema = z.object({
  id: z.string().uuid(),
  is_active: z.boolean(),
})

export const deleteAccountCategorySchema = z.object({
  id: z.string().uuid(),
})
