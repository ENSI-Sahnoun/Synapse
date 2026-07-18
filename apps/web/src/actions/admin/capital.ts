'use server'

import { revalidatePath } from 'next/cache'
import { adminActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'
import { recordCapitalMovementSchema, recordCapitalTransferSchema } from '@/utils/zod-schemas/capital'

export const recordCapitalMovementAction = adminActionClient
  .schema(recordCapitalMovementSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase.from('capital_movements').insert({
      ...parsedInput,
      created_by: ctx.userId,
    })
    if (error) throw new Error(error.message)
    revalidatePath('/admin/accounting')
    return { success: true }
  })

export const recordCapitalTransferAction = adminActionClient
  .schema(recordCapitalTransferSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase.from('capital_transfers').insert({
      ...parsedInput,
      created_by: ctx.userId,
    })
    if (error) throw new Error(error.message)
    revalidatePath('/admin/accounting')
    return { success: true }
  })
