'use server'

import { adminActionClient } from '@/lib/safe-action'
import { createCategorySchema, deleteCategorySchema, reorderCategoriesSchema } from '@/utils/zod-schemas/product-category'
import { createSupabaseAdminClient } from '@/supabase-clients/admin'
import { revalidatePath } from 'next/cache'

export const createCategoryAction = adminActionClient
  .schema(createCategorySchema)
  .action(async ({ parsedInput }) => {
    const supabase = createSupabaseAdminClient()
    const { error } = await supabase.from('product_categories').insert(parsedInput)
    if (error) throw new Error('Catégorie déjà existante ou erreur')
    revalidatePath('/admin/products')
    return { success: true }
  })

export const reorderCategoriesAction = adminActionClient
  .schema(reorderCategoriesSchema)
  .action(async ({ parsedInput: { ids } }) => {
    const supabase = createSupabaseAdminClient()
    // ids arrive in the desired display order; index becomes sort_order.
    const results = await Promise.all(
      ids.map((id, index) => supabase.from('product_categories').update({ sort_order: index }).eq('id', id))
    )
    if (results.some((r) => r.error)) throw new Error('Erreur lors du réordonnancement')
    revalidatePath('/admin/products')
    return { success: true }
  })

export const deleteCategoryAction = adminActionClient
  .schema(deleteCategorySchema)
  .action(async ({ parsedInput: { id } }) => {
    const supabase = createSupabaseAdminClient()
    const { error } = await supabase.from('product_categories').delete().eq('id', id)
    if (error) throw new Error('Erreur lors de la suppression')
    revalidatePath('/admin/products')
    return { success: true }
  })
