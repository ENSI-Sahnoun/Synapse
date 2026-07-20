import { z } from 'zod'

// Trimmed before the length check: a reason of spaces is no reason at all, and
// the SQL CHECK (`length(trim(reason)) > 0`) would reject it with a raw
// constraint-violation message instead of a usable one.
const reason = z.string().trim().min(1, 'Motif requis').max(500)
const amount = z.coerce.number().positive('Montant doit être positif')

export const refundPurchaseSchema = z.object({
  purchaseId: z.string().uuid('Vente invalide'),
  amount,
  reason,
  // Only honoured on a full refund — a partial one cannot say which line of
  // the basket came back.
  restock: z.boolean().default(true),
})

export type RefundPurchaseInput = z.infer<typeof refundPurchaseSchema>

export const refundSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid('Abonnement invalide'),
  amount,
  reason,
  endNow: z.boolean().default(true),
})

export type RefundSubscriptionInput = z.infer<typeof refundSubscriptionSchema>

export const refundLockerPaymentSchema = z.object({
  lockerPaymentId: z.string().uuid('Paiement invalide'),
  amount,
  reason,
})

export type RefundLockerPaymentInput = z.infer<typeof refundLockerPaymentSchema>
