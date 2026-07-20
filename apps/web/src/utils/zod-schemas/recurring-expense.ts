import { z } from 'zod'

export const recurringFrequencies = ['monthly', 'quarterly', 'yearly'] as const

export type RecurringFrequency = (typeof recurringFrequencies)[number]

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (YYYY-MM-DD)')

export const createRecurringExpenseSchema = z
  .object({
    account_category_id: z.string().uuid('Catégorie invalide'),
    description: z.string().min(1, 'Description requise').max(255),
    amount_dt: z.coerce.number().positive('Montant doit être positif'),
    frequency: z.enum(recurringFrequencies),
    // Mirrors the 1..28 CHECK: every month has a 28th, so no occurrence can be
    // silently skipped in February.
    day_of_month: z.coerce.number().int().min(1, 'Jour entre 1 et 28').max(28, 'Jour entre 1 et 28'),
    starts_on: dateSchema,
    ends_on: dateSchema.optional().nullable(),
    is_active: z.boolean().optional(),
  })
  .refine((v) => !v.ends_on || v.ends_on >= v.starts_on, {
    message: 'La date de fin doit suivre la date de début',
    path: ['ends_on'],
  })

export type CreateRecurringExpenseInput = z.infer<typeof createRecurringExpenseSchema>

export const updateRecurringExpenseSchema = z.object({
  id: z.string().uuid(),
  account_category_id: z.string().uuid('Catégorie invalide').optional(),
  description: z.string().min(1, 'Description requise').max(255).optional(),
  amount_dt: z.coerce.number().positive('Montant doit être positif').optional(),
  frequency: z.enum(recurringFrequencies).optional(),
  day_of_month: z.coerce.number().int().min(1).max(28).optional(),
  starts_on: dateSchema.optional(),
  ends_on: dateSchema.optional().nullable(),
  is_active: z.boolean().optional(),
})

export const deleteRecurringExpenseSchema = z.object({
  id: z.string().uuid(),
})

export const materialiseRecurringExpensesSchema = z.object({
  // Defaults to today in the RPC when omitted.
  through: dateSchema.optional(),
})
