'use server'

import { adminActionClient } from '@/lib/safe-action'
import {
  createSubscriptionPlanSchema,
  updateSubscriptionPlanSchema,
  togglePlanSchema,
} from '@/utils/zod-schemas/subscription-plan'
import { createSupabaseClient } from '@/supabase-clients/server'
import { createSupabaseAdminClient } from '@/supabase-clients/admin'
import { revalidatePath } from 'next/cache'

export const createPlanAction = adminActionClient
  .schema(createSubscriptionPlanSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createSupabaseClient()
    const { data, error } = await supabase
      .from('subscription_plans')
      .insert(parsedInput)
      .select()
      .single()
    if (error) throw new Error(error.message)
    const admin = createSupabaseAdminClient()
    await admin.from('subscription_plan_activity_log').insert({
      action: 'plan_create',
      plan_id: data.id,
      actor_id: ctx.userId,
      details: { new: parsedInput },
    })
    revalidatePath('/admin/subscription-plans')
    return { plan: data }
  })

export const updatePlanAction = adminActionClient
  .schema(updateSubscriptionPlanSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { id, ...updates } = parsedInput
    const supabase = await createSupabaseClient()
    const { data: before } = await supabase
      .from('subscription_plans')
      .select()
      .eq('id', id)
      .single()
    const { error } = await supabase
      .from('subscription_plans')
      .update(updates)
      .eq('id', id)
    if (error) throw new Error(error.message)
    const keys = Object.keys(updates) as (keyof typeof updates)[]
    const old = before ? Object.fromEntries(keys.map((k) => [k, before[k as keyof typeof before]])) : {}
    const admin = createSupabaseAdminClient()
    await admin.from('subscription_plan_activity_log').insert({
      action: 'plan_update',
      plan_id: id,
      actor_id: ctx.userId,
      details: { old, new: updates },
    })
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
