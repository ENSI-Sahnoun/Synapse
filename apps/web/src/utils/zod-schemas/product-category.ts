import { z } from 'zod'

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Nom requis').max(50),
  emoji: z.string().max(8).nullish(),
})

export const deleteCategorySchema = z.object({ id: z.string().uuid() })

// Ordered list of category ids; index becomes sort_order.
export const reorderCategoriesSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
})

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
