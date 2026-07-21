'use server'

import { createSupabaseClient } from '@/supabase-clients/server'
import { INTERNAL_NOTIFICATION_TYPES } from '@/lib/notification-types'

export interface NotificationRow {
  id: string
  type: string
  message: string
  is_read: boolean
  created_at: string
  link: string | null
  progress_current: number | null
  progress_target: number | null
}

export async function getMyNotifications(limit = 20): Promise<NotificationRow[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, message, is_read, created_at, link, progress_current, progress_target')
    .not('type', 'in', `(${INTERNAL_NOTIFICATION_TYPES.join(',')})`)
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
    .not('type', 'in', `(${INTERNAL_NOTIFICATION_TYPES.join(',')})`)
  if (error) throw error
  return count ?? 0
}

export interface ImportantNotificationRow extends NotificationRow {
  is_important: boolean
  important_until: string
}

export async function getMyImportantNotifications(): Promise<ImportantNotificationRow[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, message, is_read, created_at, link, is_important, important_until')
    .eq('is_important', true)
    .gt('important_until', new Date().toISOString())
    .order('created_at', { ascending: false })
  // ponytail: important banner is optional UI — a query failure (e.g. missing
  // migration in an environment) must not 500 the whole dashboard. Degrade to
  // no banner and log instead of throwing.
  if (error) {
    console.error('getMyImportantNotifications failed, hiding banner:', error)
    return []
  }
  return (data ?? []) as ImportantNotificationRow[]
}

export async function getNotificationsForUser(
  userId: string,
  limit = 20,
): Promise<NotificationRow[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, message, is_read, created_at, link, progress_current, progress_target')
    .eq('user_id', userId)
    .not('type', 'in', `(${INTERNAL_NOTIFICATION_TYPES.join(',')})`)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as NotificationRow[]
}
