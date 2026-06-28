-- Seed default loyalty rules (skip if already seeded)
INSERT INTO public.loyalty_rules (name, reward_type, points_threshold, reward_value, is_active)
SELECT name, reward_type, points_threshold, reward_value, true
FROM (VALUES
  ('Journée gratuite',  'free_day',      70, 0),
  ('Café offert',       'free_coffee',   30, 0),
  ('Réduction 10%',     'discount_pct',  50, 10)
) AS defaults(name, reward_type, points_threshold, reward_value)
WHERE NOT EXISTS (SELECT 1 FROM public.loyalty_rules LIMIT 1);

-- Redemption requests table
CREATE TABLE public.loyalty_redemption_requests (
  id          uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  student_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rule_id     uuid        NOT NULL REFERENCES public.loyalty_rules(id) ON DELETE RESTRICT,
  status      text        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'fulfilled', 'rejected')),
  points_used int         NOT NULL CHECK (points_used > 0),
  handled_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  handled_at  timestamptz
);

-- Index: employee view queries pending requests sorted by created_at
CREATE INDEX loyalty_redemption_requests_status_idx
  ON public.loyalty_redemption_requests (status, created_at DESC);

-- Index: student queries own requests
CREATE INDEX loyalty_redemption_requests_student_idx
  ON public.loyalty_redemption_requests (student_id, created_at DESC);

ALTER TABLE public.loyalty_redemption_requests ENABLE ROW LEVEL SECURITY;

-- Students: read own requests, insert own requests
CREATE POLICY "redemption_requests_select_own" ON public.loyalty_redemption_requests
  FOR SELECT USING (
    student_id = auth.uid()
    OR public.current_user_role() IN ('admin', 'employee')
  );

CREATE POLICY "redemption_requests_insert" ON public.loyalty_redemption_requests
  FOR INSERT WITH CHECK (
    student_id = auth.uid()
    AND public.current_user_role() = 'student'
  );

-- Employees and admins: update status + handled_by + handled_at
CREATE POLICY "redemption_requests_update" ON public.loyalty_redemption_requests
  FOR UPDATE USING (public.current_user_role() IN ('admin', 'employee'));

-- Admin only: delete
CREATE POLICY "redemption_requests_delete" ON public.loyalty_redemption_requests
  FOR DELETE USING (public.current_user_role() = 'admin');
