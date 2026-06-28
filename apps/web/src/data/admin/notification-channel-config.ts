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
    .from('notification_channel_config')
    .select('channel')
    .eq('notification_type', notificationType)
    .eq('is_enabled', true)
  if (error) throw error
  return (data ?? []).map((r) => r.channel as NotificationChannel)
}

export async function getAllChannelConfigs(): Promise<ChannelConfigRow[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('notification_channel_config')
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
    .from('notification_channel_config')
    .upsert(
      {
        notification_type: notificationType,
        channel,
        is_enabled: isEnabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'notification_type,channel' },
    )
  if (error) throw error
}
