-- "Drop to kiosk": staff push a student's QR to the check-in kiosk's screen
-- so the student can scan it from a distance instead of the staff device.
-- Two new notification types (kiosk_qr_drop / kiosk_qr_drop_cancel), both
-- excluded from the bell/toast/history like qr_airdrop already is.
--
-- student_id lets the kiosk watch the `attendance` table (already in the
-- realtime publication) for that specific student's check-in, so the drop
-- can auto-revert the instant they're checked in from any device.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.profiles(id);

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
    'kiosk_qr_drop_cancel'
  ));
