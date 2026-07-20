'use server'

import { adminActionClient } from '@/lib/safe-action'
import {
  editPurchaseItemSchema,
  voidPurchaseSchema,
  editSubscriptionSchema,
  voidSubscriptionSchema,
  voidChargeSchema,
} from '@/utils/zod-schemas/transaction-correction'
import { createSupabaseClient } from '@/supabase-clients/server'
import { revalidatePath } from 'next/cache'

const BOUTIQUE_PATH = '/admin/analytics/pos'

export const editPurchaseItemAction = adminActionClient
  .schema(editPurchaseItemSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { data, error } = await supabase.rpc('pos_edit_purchase_item', {
      p_item_id: parsedInput.item_id,
      p_quantity: parsedInput.quantity,
      p_product_id: parsedInput.product_id,
    })
    if (error) throw new Error(error.message)
    revalidatePath(BOUTIQUE_PATH)
    return data
  })

export const voidPurchaseAction = adminActionClient
  .schema(voidPurchaseSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { data, error } = await supabase.rpc('pos_void_purchase', {
      p_purchase_id: parsedInput.purchase_id,
    })
    if (error) throw new Error(error.message)
    revalidatePath(BOUTIQUE_PATH)
    return data
  })

export const editSubscriptionAction = adminActionClient
  .schema(editSubscriptionSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { data, error } = await supabase.rpc('pos_edit_subscription', {
      p_subscription_id: parsedInput.subscription_id,
      p_plan_id: parsedInput.plan_id,
    })
    if (error) throw new Error(error.message)
    revalidatePath(BOUTIQUE_PATH)
    return data
  })

export const voidSubscriptionAction = adminActionClient
  .schema(voidSubscriptionSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { data, error } = await supabase.rpc('pos_void_subscription', {
      p_subscription_id: parsedInput.subscription_id,
    })
    if (error) throw new Error(error.message)
    revalidatePath(BOUTIQUE_PATH)
    return data
  })

export const voidChargeAction = adminActionClient
  .schema(voidChargeSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { data, error } = await supabase.rpc('pos_void_charge', {
      p_activity_log_id: parsedInput.activity_log_id,
    })
    if (error) throw new Error(error.message)
    revalidatePath(BOUTIQUE_PATH)
    return data
  })
