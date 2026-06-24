-- apps/database/supabase/migrations/20260623000006_smp_loyalty_ledger.sql

CREATE TABLE public.loyalty_ledger (
  id           uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  student_id   uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  points_delta int         NOT NULL,
  reason       text        NOT NULL CHECK (reason IN ('subscription', 'redemption', 'adjustment')),
  ref_id       uuid,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX loyalty_ledger_student_idx ON public.loyalty_ledger (student_id, created_at DESC);

ALTER TABLE public.loyalty_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loyalty_ledger_select_own" ON public.loyalty_ledger
  FOR SELECT USING (
    student_id = auth.uid()
    OR current_user_role() IN ('admin', 'employee')
  );

CREATE POLICY "loyalty_ledger_insert" ON public.loyalty_ledger
  FOR INSERT WITH CHECK (current_user_role() IN ('admin', 'employee'));

CREATE POLICY "loyalty_ledger_update" ON public.loyalty_ledger
  FOR UPDATE USING (current_user_role() = 'admin');
