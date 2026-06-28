'use server'

import { adminActionClient } from '@/lib/safe-action'
import { upsertChannelConfigSchema } from '@/utils/zod-schemas/notification-channel-config'
import { upsertChannelConfig } from '@/data/admin/notification-channel-config'

export const toggleNotificationChannel = adminActionClient
  .schema(upsertChannelConfigSchema)
  .action(async ({ parsedInput: { notification_type, channel, is_enabled } }) => {
    await upsertChannelConfig(notification_type, channel, is_enabled)
    return { success: true }
  })
