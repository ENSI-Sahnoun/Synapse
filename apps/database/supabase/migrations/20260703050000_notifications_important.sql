ALTER TABLE public.notifications
  ADD COLUMN is_important boolean NOT NULL DEFAULT false,
  ADD COLUMN important_until timestamptz;

ALTER TABLE public.notifications
  DROP CONSTRAINT notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'expiry_7d', 'expiry_3d', 'expiry_1d', 'expired', 'renewal_reminder',
    'reservation_confirmed', 'reservation_new', 'reservation_cancelled', 'reservation_accepted',
    'points_earned', 'purchase_completed', 'subscription_new',
    'loyalty_request_new', 'loyalty_fulfilled', 'loyalty_rejected',
    'room_almost_full', 'seat_swap_request_new', 'seat_swap_accepted', 'seat_swap_denied',
    'announcement_new'
  ));
