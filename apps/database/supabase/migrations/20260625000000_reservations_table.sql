-- apps/database/supabase/migrations/20260625000000_reservations_table.sql

-- ============================================================
-- RESERVATIONS TABLE
-- ============================================================
CREATE TABLE public.reservations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seat_id       uuid NOT NULL REFERENCES public.seats(id) ON DELETE CASCADE,
  reserved_at   timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  status        text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','expired','fulfilled')),
  queue_position int  -- exam mode only; NULL in normal mode
);

-- ============================================================
-- ONE ACTIVE RESERVATION PER STUDENT — DB-enforced
-- ============================================================
-- Partial unique index: (student_id) must be unique among 'active' rows only.
-- Attempting to INSERT a second active reservation for the same student will
-- raise a unique-violation error (code 23505) that the server action catches.
CREATE UNIQUE INDEX reservations_one_active_per_student
  ON public.reservations (student_id)
  WHERE status = 'active';

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Students can see only their own reservations
CREATE POLICY "student_select_own_reservations"
  ON public.reservations FOR SELECT
  USING (
    student_id = auth.uid()
    OR current_user_role() IN ('admin', 'employee')
  );

-- Only students (with active sub) may INSERT — enforced in server action too
-- RLS insert check: student can only insert a row for themselves
CREATE POLICY "student_insert_own_reservation"
  ON public.reservations FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    AND current_user_role() = 'student'
  );

-- Employees and admins can do anything
CREATE POLICY "staff_all_reservations"
  ON public.reservations FOR ALL
  USING (current_user_role() IN ('admin', 'employee'))
  WITH CHECK (current_user_role() IN ('admin', 'employee'));

-- Service role (pg_cron, server actions) bypasses RLS automatically

-- ============================================================
-- INDEX: fast lookup of active reservation for a student
-- ============================================================
CREATE INDEX reservations_student_active_idx
  ON public.reservations (student_id)
  WHERE status = 'active';

-- ============================================================
-- INDEX: fast lookup of active reservations for a seat
-- ============================================================
CREATE INDEX reservations_seat_active_idx
  ON public.reservations (seat_id)
  WHERE status = 'active';
