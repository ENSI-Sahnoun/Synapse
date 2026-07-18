'use server'

import { adminActionClient } from '@/lib/safe-action'
import { createProductSchema, updateProductSchema, productIdSchema, reorderProductsSchema } from '@/utils/zod-schemas/product'
import { restockProductSchema } from '@/utils/zod-schemas/restock'
import { createSupabaseAdminClient } from '@/supabase-clients/admin'
import { createSupabaseClient } from '@/supabase-clients/server'
import { getProductById } from '@/data/admin/products'
import { revalidatePath } from 'next/cache'

export const createProductAction = adminActionClient
  .schema(createProductSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase.from('products').insert(parsedInput).select('id').single()
    if (error) throw new Error('Erreur lors de la création du produit')
    await supabase.from('pos_activity_log').insert({
      action: 'product_create',
      product_id: data.id,
      actor_id: ctx.userId,
      details: parsedInput,
    })
    revalidatePath('/admin/products')
    return { success: true }
  })

export const reorderProductsAction = adminActionClient
  .schema(reorderProductsSchema)
  .action(async ({ parsedInput: { ids } }) => {
    const supabase = createSupabaseAdminClient()
    // ids arrive in the desired display order; index becomes sort_order.
    const results = await Promise.all(
      ids.map((id, index) => supabase.from('products').update({ sort_order: index }).eq('id', id))
    )
    if (results.some((r) => r.error)) throw new Error('Erreur lors du réordonnancement')
    revalidatePath('/admin/products')
    return { success: true }
  })

export const updateProductAction = adminActionClient
  .schema(updateProductSchema)
  .action(async ({ parsedInput: { id, ...updates }, ctx }) => {
    const supabase = createSupabaseAdminClient()
    const before = await getProductById(id)
    const { error } = await supabase.from('products').update(updates).eq('id', id)
    if (error) throw new Error('Erreur lors de la mise à jour du produit')
    const keys = Object.keys(updates) as (keyof typeof updates)[]
    const old = before ? Object.fromEntries(keys.map((k) => [k, before[k as keyof typeof before]])) : {}
    await supabase.from('pos_activity_log').insert({
      action: 'product_update',
      product_id: id,
      actor_id: ctx.userId,
      details: { old, new: updates },
    })
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

export const restockProductAction = adminActionClient
  .schema(restockProductSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { data, error } = await supabase.rpc('pos_restock', {
      p_product_id: parsedInput.product_id,
      p_quantity: parsedInput.quantity,
      p_cost_price: parsedInput.cost_price,
      p_tax_rate_pct: parsedInput.tax_rate_pct,
    })
    if (error) throw new Error(error.message)
    const result = data as { new_stock_quantity: number; expense_id: string }
    revalidatePath('/admin/products')
    revalidatePath('/admin/accounting')
    return { newStockQuantity: result.new_stock_quantity, expenseId: result.expense_id }
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
