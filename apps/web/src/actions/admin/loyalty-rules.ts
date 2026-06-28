'use server'

import { adminActionClient } from '@/lib/safe-action'
import {
  createLoyaltyRuleSchema,
  updateLoyaltyRuleSchema,
  toggleLoyaltyRuleSchema,
} from '@/utils/zod-schemas/loyalty-rule'
import { createSupabaseClient } from '@/supabase-clients/server'
import { revalidatePath } from 'next/cache'

export const createLoyaltyRuleAction = adminActionClient
  .schema(createLoyaltyRuleSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { data, error } = await supabase
      .from('loyalty_rules')
      .insert({ ...parsedInput, is_active: true })
      .select()
      .single()
    if (error) throw new Error(error.message)
    revalidatePath('/admin/loyalty')
    return { rule: data }
  })

export const updateLoyaltyRuleAction = adminActionClient
  .schema(updateLoyaltyRuleSchema)
  .action(async ({ parsedInput }) => {
    const { id, ...updates } = parsedInput
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('loyalty_rules')
      .update(updates)
      .eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/loyalty')
    return { success: true }
  })

export const toggleLoyaltyRuleAction = adminActionClient
  .schema(toggleLoyaltyRuleSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('loyalty_rules')
      .update({ is_active: parsedInput.is_active })
      .eq('id', parsedInput.id)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/loyalty')
    return { success: true }
  })
