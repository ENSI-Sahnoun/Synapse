ALTER TABLE public.reservations
  DROP CONSTRAINT reservations_status_check;

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_status_check
  CHECK (status IN ('active', 'expired', 'fulfilled', 'cancelled', 'confirmed'));
