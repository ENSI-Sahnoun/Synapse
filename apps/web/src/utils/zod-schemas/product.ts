import { z } from 'zod'

export const createProductSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(100),
  category: z.string().min(1, 'Catégorie requise').max(50),
  price_dt: z.coerce.number().min(0, 'Prix invalide'),
  stock_quantity: z.coerce.number().int().min(0, 'Stock invalide'),
})

export const updateProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  category: z.string().min(1).max(50).optional(),
  price_dt: z.coerce.number().min(0).optional(),
  stock_quantity: z.coerce.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
})

export const productIdSchema = z.object({ id: z.string().uuid() })

export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
