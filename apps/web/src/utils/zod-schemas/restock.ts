import { z } from 'zod'

export const restockProductSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.coerce.number().int().min(1, 'Quantité minimum 1'),
  cost_price: z.coerce.number().min(0, 'Coût invalide'),
  tax_rate_pct: z.coerce.number().min(0).max(100).default(19),
})

export type RestockInput = z.infer<typeof restockProductSchema>
