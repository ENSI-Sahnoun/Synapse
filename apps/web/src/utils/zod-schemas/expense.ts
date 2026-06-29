import { z } from 'zod'

export const createExpenseSchema = z.object({
  account_category_id: z.string().uuid('Catégorie invalide'),
  description: z.string().min(1, 'Description requise').max(255),
  amount_dt: z.coerce.number().positive('Montant doit être positif'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (YYYY-MM-DD)'),
})

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>

export const updateExpenseSchema = createExpenseSchema.partial().extend({
  id: z.string().uuid(),
})

export const deleteExpenseSchema = z.object({
  id: z.string().uuid(),
})
