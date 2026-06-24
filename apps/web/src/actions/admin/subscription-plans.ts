'use server'

import { adminActionClient } from '@/lib/safe-action'
import {
  createSubscriptionPlanSchema,
  updateSubscriptionPlanSchema,
  togglePlanSchema,
} from '@/utils/zod-schemas/subscription-plan'
import { createSupabaseClient } from '@/supabase-clients/server'
import { revalidatePath } from 'next/cache'

export const createPlanAction = adminActionClient
  .schema(createSubscriptionPlanSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { data, error } = await supabase
      .from('subscription_plans')
      .insert(parsedInput)
      .select()
      .single()
    if (error) throw new Error(error.message)
    revalidatePath('/admin/subscription-plans')
    return { plan: data }
  })

export const updatePlanAction = adminActionClient
  .schema(updateSubscriptionPlanSchema)
  .action(async ({ parsedInput }) => {
    const { id, ...updates } = parsedInput
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('subscription_plans')
      .update(updates)
      .eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/subscription-plans')
    return { success: true }
  })

export const togglePlanAction = adminActionClient
  .schema(togglePlanSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('subscription_plans')
      .update({ is_active: parsedInput.is_active })
      .eq('id', parsedInput.id)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/subscription-plans')
    return { success: true }
  })
