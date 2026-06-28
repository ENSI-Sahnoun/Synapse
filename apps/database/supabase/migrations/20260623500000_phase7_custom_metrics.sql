-- apps/database/supabase/migrations/20260623500000_phase7_custom_metrics.sql

-- Custom metrics table (may already exist from earlier phases; use IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS public.custom_metrics (
  id                   uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name                 text        NOT NULL,
  unit                 text        NOT NULL DEFAULT '',
  target_value         numeric,
  is_dashboard_visible boolean     NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_metrics_select" ON public.custom_metrics
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "custom_metrics_write" ON public.custom_metrics
  FOR ALL USING (public.current_user_role() = 'admin');

-- expenses table (may already exist)
CREATE TABLE IF NOT EXISTS public.expenses (
  id                  uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_category_id uuid        NOT NULL REFERENCES public.account_categories(id),
  description         text        NOT NULL DEFAULT '',
  amount_dt           numeric     NOT NULL CHECK (amount_dt >= 0),
  date                date        NOT NULL DEFAULT CURRENT_DATE,
  created_by          uuid        NOT NULL REFERENCES public.profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_select" ON public.expenses
  FOR SELECT USING (public.current_user_role() = 'admin');

CREATE POLICY "expenses_insert" ON public.expenses
  FOR INSERT WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "expenses_update" ON public.expenses
  FOR UPDATE USING (public.current_user_role() = 'admin');

CREATE POLICY "expenses_delete" ON public.expenses
  FOR DELETE USING (public.current_user_role() = 'admin');

-- Seed a few custom metrics for demo
INSERT INTO public.custom_metrics (name, unit, target_value, is_dashboard_visible) VALUES
  ('Nouveaux étudiants ce mois', 'étudiants', 50, true),
  ('Chiffre d''affaires mensuel', 'DT', 3000, true)
ON CONFLICT DO NOTHING;
