-- apps/database/supabase/migrations/20260703030000_seat_swap_requests.sql

-- ============================================================
-- SEAT SWAP REQUESTS
-- ============================================================
-- A checked-in student (seated or in "Divers") can ask to move to a
-- different free seat without checking out. Staff approve/deny; on
-- approval the swap is executed exactly like a manual employee change.
CREATE TABLE public.seat_swap_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attendance_id uuid NOT NULL REFERENCES public.attendance(id) ON DELETE CASCADE,
  from_seat_id  uuid REFERENCES public.seats(id) ON DELETE SET NULL,
  to_seat_id    uuid NOT NULL REFERENCES public.seats(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'accepted', 'denied', 'cancelled')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz,
  resolved_by   uuid REFERENCES public.profiles(id)
);

-- Only one pending request per student at a time
CREATE UNIQUE INDEX seat_swap_requests_one_pending_per_student
  ON public.seat_swap_requests (student_id)
  WHERE status = 'pending';

CREATE INDEX seat_swap_requests_pending_idx
  ON public.seat_swap_requests (created_at)
  WHERE status = 'pending';

ALTER TABLE public.seat_swap_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_select_own_swap_requests"
  ON public.seat_swap_requests FOR SELECT
  USING (
    student_id = auth.uid()
    OR current_user_role() IN ('admin', 'employee')
  );

CREATE POLICY "student_insert_own_swap_request"
  ON public.seat_swap_requests FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    AND current_user_role() = 'student'
  );

-- Students may only cancel their own pending request (not flip it to accepted/denied)
CREATE POLICY "student_cancel_own_swap_request"
  ON public.seat_swap_requests FOR UPDATE
  USING (student_id = auth.uid() AND status = 'pending')
  WITH CHECK (student_id = auth.uid() AND status = 'cancelled');

CREATE POLICY "staff_all_swap_requests"
  ON public.seat_swap_requests FOR ALL
  USING (current_user_role() IN ('admin', 'employee'))
  WITH CHECK (current_user_role() IN ('admin', 'employee'));

-- ============================================================
-- NOTIFICATION TYPES for swap requests
-- ============================================================
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
    'seat_swap_denied'
  ));
