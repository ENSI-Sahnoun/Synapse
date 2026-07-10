import { z } from 'zod'

export const openCashSessionSchema = z.object({
  opening_amount_dt: z.coerce.number().min(0, 'Montant invalide'),
})

export type OpenCashSessionInput = z.infer<typeof openCashSessionSchema>

export const addCashMovementSchema = z.object({
  session_id: z.string().uuid('Session invalide'),
  type: z.enum(['in', 'out']),
  amount_dt: z.coerce.number().gt(0, 'Montant invalide'),
  reason: z.string().trim().min(1, 'Motif requis').max(200, 'Motif trop long'),
})

export type AddCashMovementInput = z.infer<typeof addCashMovementSchema>

export const closeCashSessionSchema = z.object({
  session_id: z.string().uuid('Session invalide'),
  closing_amount_dt: z.coerce.number().min(0, 'Montant invalide'),
  notes: z.string().trim().max(500, 'Note trop longue').nullable().default(null),
})

export type CloseCashSessionInput = z.infer<typeof closeCashSessionSchema>
