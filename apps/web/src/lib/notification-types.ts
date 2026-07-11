export type NotificationType =
  | 'expiry_7d'
  | 'expiry_3d'
  | 'expiry_1d'
  | 'expired'
  | 'renewal_reminder'
  | 'reservation_confirmed'
  | 'reservation_new'
  | 'reservation_cancelled'
  | 'reservation_accepted'
  | 'points_earned'
  | 'purchase_completed'
  | 'subscription_new'
  | 'loyalty_request_new'
  | 'loyalty_fulfilled'
  | 'loyalty_rejected'
  | 'room_almost_full'
  | 'seat_swap_request_new'
  | 'seat_swap_accepted'
  | 'seat_swap_denied'
  | 'announcement_new'
  | 'seat_removed_by_staff'
  | 'seat_changed_freely'
  | 'qr_airdrop'
  | 'kiosk_qr_drop'
  | 'kiosk_qr_drop_cancel'

export type NotificationChannel = 'email' | 'sms' | 'whatsapp' | 'inapp'

/**
 * Notification types that exist purely as a realtime transport for a
 * specific UI (the QR airdrop popup, the kiosk QR display) — never shown
 * in the bell, toast, or notification history. Every read path that lists
 * a user's notifications must exclude these.
 */
export const INTERNAL_NOTIFICATION_TYPES: readonly NotificationType[] = [
  'qr_airdrop',
  'kiosk_qr_drop',
  'kiosk_qr_drop_cancel',
]
