'use server'

import { adminActionClient } from '@/lib/safe-action'
import { createCategorySchema, deleteCategorySchema } from '@/utils/zod-schemas/product-category'
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

export const deleteCategoryAction = adminActionClient
  .schema(deleteCategorySchema)
  .action(async ({ parsedInput: { id } }) => {
    const supabase = createSupabaseAdminClient()
    const { error } = await supabase.from('product_categories').delete().eq('id', id)
    if (error) throw new Error('Erreur lors de la suppression')
    revalidatePath('/admin/products')
    return { success: true }
  })
