import { z } from 'zod'

export const notificationTypeSchema = z.enum([
  'expiry_7d',
  'expiry_3d',
  'expiry_1d',
  'expired',
  'renewal_reminder',
])

export const notificationChannelSchema = z.enum(['email', 'sms', 'whatsapp'])

export const upsertChannelConfigSchema = z.object({
  notification_type: notificationTypeSchema,
  channel: notificationChannelSchema,
  is_enabled: z.boolean(),
})

export type UpsertChannelConfigInput = z.infer<typeof upsertChannelConfigSchema>
