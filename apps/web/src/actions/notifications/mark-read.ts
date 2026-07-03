'use server'

import { z } from 'zod'
import { authActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'

const markOneReadSchema = z.object({
  notificationId: z.string().uuid(),
})

const markAllReadSchema = z.object({})

export const markNotificationRead = authActionClient
  .schema(markOneReadSchema)
  .action(async ({ parsedInput: { notificationId }, ctx: { userId } }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', userId)
      .eq('is_read', false)
    if (error) throw error
    return { success: true }
  })

export const markAllNotificationsRead = authActionClient
  .schema(markAllReadSchema)
  .action(async ({ ctx: { userId } }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)
    if (error) throw error
    return { success: true }
  })

export const clearNotification = authActionClient
  .schema(markOneReadSchema)
  .action(async ({ parsedInput: { notificationId }, ctx: { userId } }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', userId)
    if (error) throw error
    return { success: true }
  })

export const clearAllNotifications = authActionClient
  .schema(markAllReadSchema)
  .action(async ({ ctx: { userId } }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId)
    if (error) throw error
    return { success: true }
  })
