import { z } from 'zod'

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Nom requis').max(50),
})

export const deleteCategorySchema = z.object({ id: z.string().uuid() })

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
