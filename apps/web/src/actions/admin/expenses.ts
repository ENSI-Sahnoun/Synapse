'use server'

import { revalidatePath } from 'next/cache'
import { adminActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'
import {
  createExpenseSchema,
  updateExpenseSchema,
  deleteExpenseSchema,
} from '@/utils/zod-schemas/expense'

export const createExpenseAction = adminActionClient
  .schema(createExpenseSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase.from('expenses').insert({
      ...parsedInput,
      created_by: ctx.userId,
    })
    if (error) throw new Error(error.message)
    revalidatePath('/admin/accounting')
    return { success: true }
  })

export const updateExpenseAction = adminActionClient
  .schema(updateExpenseSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { id, ...fields } = parsedInput
    const { error } = await supabase
      .from('expenses')
      .update(fields)
      .eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/accounting')
    return { success: true }
  })

export const deleteExpenseAction = adminActionClient
  .schema(deleteExpenseSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', parsedInput.id)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/accounting')
    return { success: true }
  })
