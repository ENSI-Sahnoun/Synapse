'use server'

import { revalidatePath } from 'next/cache'
import { adminActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'
import {
  createCustomMetricSchema,
  updateCustomMetricSchema,
  deleteCustomMetricSchema,
} from '@/utils/zod-schemas/custom-metric'

export const createCustomMetricAction = adminActionClient
  .schema(createCustomMetricSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase.from('custom_metrics').insert(parsedInput)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/settings/metrics')
    revalidatePath('/admin/dashboard')
    return { success: true }
  })

export const updateCustomMetricAction = adminActionClient
  .schema(updateCustomMetricSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { id, ...fields } = parsedInput
    const { error } = await supabase.from('custom_metrics').update(fields).eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/settings/metrics')
    revalidatePath('/admin/dashboard')
    return { success: true }
  })

export const deleteCustomMetricAction = adminActionClient
  .schema(deleteCustomMetricSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase.from('custom_metrics').delete().eq('id', parsedInput.id)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/settings/metrics')
    revalidatePath('/admin/dashboard')
    return { success: true }
  })
