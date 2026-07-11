-- apps/database/supabase/migrations/20260711130000_locker_payments.sql
-- Revenue ledger for locker assignment fees. One row per fresh assignment
-- (i.e. a student who did not already hold a locker) — swapping an
-- already-paying student to a different locker does not insert a row here,
-- so revenue is not double-counted.

CREATE TABLE public.locker_payments (
  id              uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  locker_id       uuid        REFERENCES public.lockers(id) ON DELETE SET NULL,
  student_id      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  subscription_id uuid        REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  amount_dt       numeric     NOT NULL CHECK (amount_dt >= 0),
  created_by      uuid        NOT NULL REFERENCES public.profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX locker_payments_created_at_idx ON public.locker_payments (created_at DESC);
CREATE INDEX locker_payments_student_idx ON public.locker_payments (student_id, created_at DESC);

ALTER TABLE public.locker_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "locker_payments_employee_select"
  ON public.locker_payments FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('admin', 'employee'));

CREATE POLICY "locker_payments_employee_insert"
  ON public.locker_payments FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('admin', 'employee'));
