import { z } from 'zod'

export const notificationTypeSchema = z.enum([
  'expiry_7d',
  'expiry_3d',
  'expiry_1d',
  'expired',
  'renewal_reminder',
  'reservation_confirmed',
  'reservation_new',
  'reservation_cancelled',
  'reservation_accepted',
  'points_earned',
  'purchase_completed',
  'subscription_new',
  'loyalty_request_new',
  'loyalty_fulfilled',
  'loyalty_rejected',
  'room_almost_full',
  'seat_swap_request_new',
  'seat_swap_accepted',
  'seat_swap_denied',
  'announcement_new',
])

export const notificationChannelSchema = z.enum(['email', 'sms', 'whatsapp', 'inapp'])

export const upsertChannelConfigSchema = z.object({
  notification_type: notificationTypeSchema,
  channel: notificationChannelSchema,
  is_enabled: z.boolean(),
})

export type UpsertChannelConfigInput = z.infer<typeof upsertChannelConfigSchema>
