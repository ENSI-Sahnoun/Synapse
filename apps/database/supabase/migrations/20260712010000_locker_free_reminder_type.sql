-- New notification type: one-time in-app reminder asking a student to free
-- their locker after the linked subscription has expired. Sent by the daily
-- notification cron; delay configurable via settings.locker_reminder_delay_days.
ALTER TABLE public.notifications
  DROP CONSTRAINT notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'expiry_7d', 'expiry_3d', 'expiry_1d', 'expired', 'renewal_reminder',
    'reservation_confirmed', 'reservation_new', 'reservation_cancelled', 'reservation_accepted',
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
    'seat_removed_by_staff',
    'seat_changed_freely',
    'qr_airdrop',
    'kiosk_qr_drop',
    'kiosk_qr_drop_cancel',
    'locker_free_reminder'
  ));
