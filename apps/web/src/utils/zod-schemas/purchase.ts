import { z } from 'zod'

export const purchaseItemSchema = z.object({
  product_id: z.string().uuid('ID produit invalide'),
  quantity: z.coerce.number().int().min(1, 'Quantité minimum 1'),
  unit_price_dt: z.coerce.number().min(0, 'Prix invalide'),
})

export const createPurchaseSchema = z.object({
  // null = anonymous purchase (no loyalty points)
  student_id: z.string().uuid().nullable().default(null),
  items: z.array(purchaseItemSchema).min(1, 'Le panier est vide'),
  discount_dt: z.coerce.number().min(0, 'Réduction invalide').default(0),
})

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>
export type PurchaseItem = z.infer<typeof purchaseItemSchema>

// Admin-only "Charges" section: items given free to employees (0 revenue),
// booked as a dépense. No unit price — the DB reads current product prices.
export const createEmployeeChargeSchema = z.object({
  items: z
    .array(
      z.object({
        product_id: z.string().uuid('ID produit invalide'),
        quantity: z.coerce.number().int().min(1, 'Quantité minimum 1'),
      })
    )
    .min(1, 'Le panier est vide'),
})

export type CreateEmployeeChargeInput = z.infer<typeof createEmployeeChargeSchema>
