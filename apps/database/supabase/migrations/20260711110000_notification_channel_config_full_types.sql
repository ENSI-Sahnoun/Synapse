-- notification_channel_config's CHECK constraint only allowed the original
-- 5 expiry/renewal types. The admin trigger page (and NotificationType in
-- src/lib/notification-types.ts) has since grown to cover every in-app
-- notification kind, so toggling a channel for any of the newer types
-- (reservation_*, points_earned, loyalty_*, room_almost_full, etc.) violated
-- the constraint and failed with a generic server error.
ALTER TABLE public.notification_channel_config
  DROP CONSTRAINT notification_channel_config_notification_type_check;

ALTER TABLE public.notification_channel_config
  ADD CONSTRAINT notification_channel_config_notification_type_check
  CHECK (notification_type IN (
    'expiry_7d', 'expiry_3d', 'expiry_1d', 'expired', 'renewal_reminder',
    'reservation_confirmed', 'reservation_new', 'reservation_cancelled', 'reservation_accepted',
    'points_earned', 'purchase_completed', 'subscription_new',
    'loyalty_request_new', 'loyalty_fulfilled', 'loyalty_rejected',
    'room_almost_full',
    'seat_swap_request_new', 'seat_swap_accepted', 'seat_swap_denied',
    'announcement_new', 'seat_removed_by_staff', 'seat_changed_freely'
  ));
