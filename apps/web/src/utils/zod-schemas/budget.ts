import { z } from 'zod'

// Any day of the month is accepted from the UI; the action normalises it to the
// first of the month before writing, because `budgets.month` and
// `fiscal_period_locks.month` both carry a CHECK for day = 1.
const monthSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Mois invalide (YYYY-MM-DD)')

export const createBudgetSchema = z.object({
  account_category_id: z.string().uuid('Catégorie invalide'),
  month: monthSchema,
  amount_dt: z.coerce.number().min(0, 'Montant ne peut pas être négatif'),
  note: z.string().max(500).optional().nullable(),
})

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>

export const updateBudgetSchema = z.object({
  id: z.string().uuid(),
  amount_dt: z.coerce.number().min(0, 'Montant ne peut pas être négatif').optional(),
  note: z.string().max(500).optional().nullable(),
})

export const deleteBudgetSchema = z.object({
  id: z.string().uuid(),
})

export const lockPeriodSchema = z.object({
  month: monthSchema,
  note: z.string().max(500).optional().nullable(),
})

export const unlockPeriodSchema = z.object({
  month: monthSchema,
})
