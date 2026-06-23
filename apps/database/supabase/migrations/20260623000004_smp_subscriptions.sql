-- apps/database/supabase/migrations/20260623000004_smp_subscriptions.sql

CREATE TABLE public.subscriptions (
  id            uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  student_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id       uuid        NOT NULL REFERENCES public.subscription_plans(id),
  start_date    date        NOT NULL DEFAULT CURRENT_DATE,
  -- end_date always computed by application: start_date + plan.duration_days
  end_date      date        NOT NULL,
  paid_amount   numeric     NOT NULL CHECK (paid_amount >= 0),
  sold_by       uuid        NOT NULL REFERENCES public.profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Index for fast active-subscription lookups
CREATE INDEX subscriptions_student_end_date_idx
  ON public.subscriptions (student_id, end_date DESC);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Students read own subscriptions
CREATE POLICY "subscriptions_select_own" ON public.subscriptions
  FOR SELECT USING (
    student_id = auth.uid()
    OR current_user_role() IN ('admin', 'employee')
  );

-- Admin or employee can insert (sell subscription)
CREATE POLICY "subscriptions_insert" ON public.subscriptions
  FOR INSERT WITH CHECK (current_user_role() IN ('admin', 'employee'));

-- Admin only: update/delete
CREATE POLICY "subscriptions_update" ON public.subscriptions
  FOR UPDATE USING (current_user_role() = 'admin');

CREATE POLICY "subscriptions_delete" ON public.subscriptions
  FOR DELETE USING (current_user_role() = 'admin');
