'use server'

import { adminActionClient } from '@/lib/safe-action'
import { createProductSchema, updateProductSchema, productIdSchema } from '@/utils/zod-schemas/product'
import { createSupabaseAdminClient } from '@/supabase-clients/admin'
import { revalidatePath } from 'next/cache'

export const createProductAction = adminActionClient
  .schema(createProductSchema)
  .action(async ({ parsedInput }) => {
    const supabase = createSupabaseAdminClient()
    const { error } = await supabase.from('products').insert(parsedInput)
    if (error) throw new Error('Erreur lors de la création du produit')
    revalidatePath('/admin/products')
    return { success: true }
  })

export const updateProductAction = adminActionClient
  .schema(updateProductSchema)
  .action(async ({ parsedInput: { id, ...updates } }) => {
    const supabase = createSupabaseAdminClient()
    const { error } = await supabase.from('products').update(updates).eq('id', id)
    if (error) throw new Error('Erreur lors de la mise à jour du produit')
    revalidatePath('/admin/products')
    return { success: true }
  })

export const archiveProductAction = adminActionClient
  .schema(productIdSchema)
  .action(async ({ parsedInput: { id } }) => {
    const supabase = createSupabaseAdminClient()
    const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id)
    if (error) throw new Error('Erreur lors de l\'archivage du produit')
    revalidatePath('/admin/products')
    return { success: true }
  })

export const restoreProductAction = adminActionClient
  .schema(productIdSchema)
  .action(async ({ parsedInput: { id } }) => {
    const supabase = createSupabaseAdminClient()
    const { error } = await supabase.from('products').update({ is_active: true }).eq('id', id)
    if (error) throw new Error('Erreur lors de la restauration du produit')
    revalidatePath('/admin/products')
    return { success: true }
  })

export const deleteProductAction = adminActionClient
  .schema(productIdSchema)
  .action(async ({ parsedInput: { id } }) => {
    const supabase = createSupabaseAdminClient()
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) throw new Error('Erreur lors de la suppression du produit')
    revalidatePath('/admin/products')
    return { success: true }
  })
