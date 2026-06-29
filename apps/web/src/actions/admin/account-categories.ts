'use server'

import { revalidatePath } from 'next/cache'
import { adminActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'
import {
  createAccountCategorySchema,
  updateAccountCategorySchema,
  toggleAccountCategorySchema,
  deleteAccountCategorySchema,
} from '@/utils/zod-schemas/account-category'

export const createAccountCategoryAction = adminActionClient
  .schema(createAccountCategorySchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase.from('account_categories').insert(parsedInput)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/accounting/categories')
    revalidatePath('/admin/accounting')
    return { success: true }
  })

export const updateAccountCategoryAction = adminActionClient
  .schema(updateAccountCategorySchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { id, ...fields } = parsedInput
    const { error } = await supabase.from('account_categories').update(fields).eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/accounting/categories')
    revalidatePath('/admin/accounting')
    return { success: true }
  })

export const toggleAccountCategoryAction = adminActionClient
  .schema(toggleAccountCategorySchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('account_categories')
      .update({ is_active: parsedInput.is_active })
      .eq('id', parsedInput.id)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/accounting/categories')
    return { success: true }
  })

export const deleteAccountCategoryAction = adminActionClient
  .schema(deleteAccountCategorySchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()

    const { count: expenseCount } = await supabase
      .from('expenses')
      .select('*', { count: 'exact', head: true })
      .eq('account_category_id', parsedInput.id)

    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('account_category_id', parsedInput.id)

    if ((expenseCount ?? 0) > 0 || (productCount ?? 0) > 0) {
      throw new Error(
        'Cette catégorie est utilisée par des dépenses ou des produits. Désactivez-la plutôt que de la supprimer.',
      )
    }

    const { error } = await supabase.from('account_categories').delete().eq('id', parsedInput.id)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/accounting/categories')
    return { success: true }
  })
