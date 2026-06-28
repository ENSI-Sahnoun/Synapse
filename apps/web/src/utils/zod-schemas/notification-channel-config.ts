import { z } from 'zod'

export const notificationTypeSchema = z.enum([
  'expiry_7d',
  'expiry_3d',
  'expiry_1d',
  'expired',
  'renewal_reminder',
  'reservation_confirmed',
  'points_earned',
])

export const notificationChannelSchema = z.enum(['email', 'sms', 'whatsapp', 'inapp'])

export const upsertChannelConfigSchema = z.object({
  notification_type: notificationTypeSchema,
  channel: notificationChannelSchema,
  is_enabled: z.boolean(),
})

export type UpsertChannelConfigInput = z.infer<typeof upsertChannelConfigSchema>
