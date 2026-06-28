-- Extend notifications type check to include instant event types
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (
    type IN (
      'expiry_7d',
      'expiry_3d',
      'expiry_1d',
      'expired',
      'renewal_reminder',
      'reservation_confirmed',
      'points_earned'
    )
  );
