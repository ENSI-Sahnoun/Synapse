'use server'

import { createSupabaseClient } from '@/supabase-clients/server'
import type { NotificationType, NotificationChannel } from '@/lib/notification-types'

export type { NotificationType, NotificationChannel }

export interface ChannelConfigRow {
  id: string
  notification_type: NotificationType
  channel: NotificationChannel
  is_enabled: boolean
}

export async function getEnabledChannels(
  notificationType: NotificationType,
): Promise<NotificationChannel[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('notification_channel_config' as never)
    .select('channel')
    .eq('notification_type', notificationType)
    .eq('is_enabled', true)
  if (error) throw error
  return ((data ?? []) as { channel: NotificationChannel }[]).map((r) => r.channel)
}

export async function getAllChannelConfigs(): Promise<ChannelConfigRow[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('notification_channel_config' as never)
    .select('*')
    .order('notification_type')
    .order('channel')
  if (error) throw error
  return (data ?? []) as ChannelConfigRow[]
}

export async function upsertChannelConfig(
  notificationType: NotificationType,
  channel: NotificationChannel,
  isEnabled: boolean,
): Promise<void> {
  const supabase = await createSupabaseClient()
  const { error } = await supabase
    .from('notification_channel_config' as never)
    .upsert(
      {
        notification_type: notificationType,
        channel,
        is_enabled: isEnabled,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: 'notification_type,channel' },
    )
  if (error) throw error
}
