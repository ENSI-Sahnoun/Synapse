-- apps/database/supabase/migrations/20260711000000_lockers.sql

CREATE TABLE public.lockers (
  id                        uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  number                    smallint    NOT NULL UNIQUE CHECK (number BETWEEN 1 AND 9),
  assigned_student_id       uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_subscription_id  uuid        REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  is_unavailable            boolean     NOT NULL DEFAULT false,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_lockers_updated_at
  BEFORE UPDATE ON public.lockers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.lockers (number) VALUES (1), (2), (3), (4), (5), (6), (7), (8), (9);

ALTER TABLE public.lockers ENABLE ROW LEVEL SECURITY;

-- Students read only their own locker row; employees/admins read all
CREATE POLICY "lockers_select" ON public.lockers
  FOR SELECT USING (
    assigned_student_id = auth.uid()
    OR current_user_role() IN ('admin', 'employee')
  );

-- Employees/admins assign, unassign, and toggle availability
CREATE POLICY "lockers_update" ON public.lockers
  FOR UPDATE USING (current_user_role() IN ('admin', 'employee'));

-- No app insert/delete path — the 9 rows are seeded once above; admin-only as a safety net
CREATE POLICY "lockers_insert" ON public.lockers
  FOR INSERT WITH CHECK (current_user_role() = 'admin');

CREATE POLICY "lockers_delete" ON public.lockers
  FOR DELETE USING (current_user_role() = 'admin');
