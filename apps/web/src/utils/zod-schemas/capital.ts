import { z } from 'zod'

export const recordCapitalMovementSchema = z.object({
  account: z.enum(['cash', 'bank']),
  amount_dt: z.coerce.number().refine((v) => v !== 0, 'Montant ne peut pas être nul'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (YYYY-MM-DD)'),
  note: z.string().max(255).optional(),
})

export type RecordCapitalMovementInput = z.infer<typeof recordCapitalMovementSchema>

export const recordCapitalTransferSchema = z
  .object({
    from_account: z.enum(['cash', 'bank']),
    to_account: z.enum(['cash', 'bank']),
    amount_dt: z.coerce.number().positive('Montant doit être positif'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (YYYY-MM-DD)'),
    note: z.string().max(255).optional(),
  })
  .refine((v) => v.from_account !== v.to_account, {
    message: 'Les comptes source et destination doivent être différents',
    path: ['to_account'],
  })

export type RecordCapitalTransferInput = z.infer<typeof recordCapitalTransferSchema>
