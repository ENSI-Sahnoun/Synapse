'use server'

import { z } from 'zod'
import { authActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string(),
  auth: z.string(),
})

export const subscribeToPush = authActionClient
  .schema(subscribeSchema)
  .action(async ({ parsedInput: { endpoint, p256dh, auth }, ctx: { userId } }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({ user_id: userId, endpoint, p256dh, auth }, { onConflict: 'endpoint' })
    if (error) throw error
    return { success: true }
  })

const unsubscribeSchema = z.object({ endpoint: z.string().url() })

export const unsubscribeFromPush = authActionClient
  .schema(unsubscribeSchema)
  .action(async ({ parsedInput: { endpoint }, ctx: { userId } }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)
      .eq('user_id', userId)
    if (error) throw error
    return { success: true }
  })
