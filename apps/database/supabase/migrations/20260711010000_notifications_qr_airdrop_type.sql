-- New notification type: a student "airdrops" their check-in QR code to all
-- staff in realtime from their own QR page. Deliberately excluded from the
-- bell/toast/history UI (filtered client-side by type) — this type only
-- drives the dedicated airdrop popup + check-in field autofill.
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
    'qr_airdrop'
  ));
