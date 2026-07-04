'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export interface NotificationRow {
  id: string
  type: string
  message: string
  is_read: boolean
  created_at: string
}

export async function getMyNotifications(limit = 20): Promise<NotificationRow[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, message, is_read, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as NotificationRow[]
}

export async function getMyUnreadCount(): Promise<number> {
  const supabase = await createSupabaseClient()
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false)
  if (error) throw error
  return count ?? 0
}

export async function getMyImportantNotifications(): Promise<NotificationRow[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, message, is_read, created_at')
    .eq('is_important', true)
    .gt('important_until', new Date().toISOString())
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as NotificationRow[]
}

export async function getNotificationsForUser(
  userId: string,
  limit = 20,
): Promise<NotificationRow[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, message, is_read, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as NotificationRow[]
}
