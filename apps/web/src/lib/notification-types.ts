export type NotificationType =
  | 'expiry_7d'
  | 'expiry_3d'
  | 'expiry_1d'
  | 'expired'
  | 'renewal_reminder'
  | 'reservation_confirmed'
  | 'points_earned'

export type NotificationChannel = 'email' | 'sms' | 'whatsapp' | 'inapp'
