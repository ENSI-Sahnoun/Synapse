-- apps/database/supabase/migrations/20260623000005_smp_settings.sql

CREATE TABLE public.settings (
  key   text PRIMARY KEY,
  value text NOT NULL
);

INSERT INTO public.settings (key, value) VALUES
  ('reservation_hold_minutes',    '30'),
  ('exam_mode',                   'false'),
  ('priority_min_duration_days',  '30');

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read settings
CREATE POLICY "settings_select" ON public.settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Admin only: write
CREATE POLICY "settings_write" ON public.settings
  FOR ALL USING (current_user_role() = 'admin');

-- Account categories (income / expense)
CREATE TABLE public.account_categories (
  id          uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  type        text        NOT NULL CHECK (type IN ('income', 'expense')),
  name        text        NOT NULL,
  description text,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.account_categories (type, name, description) VALUES
  ('income',  'Abonnements',    'Revenus des abonnements'),
  ('income',  'Ventes en magasin', 'Snacks, boissons, fournitures'),
  ('expense', 'Loyer',          NULL),
  ('expense', 'Salaires',       NULL),
  ('expense', 'Électricité',    NULL),
  ('expense', 'Fournitures',    NULL);

-- Set default subscription income category in settings
INSERT INTO public.settings (key, value)
SELECT 'subscription_income_category_id', id::text
FROM public.account_categories
WHERE name = 'Abonnements'
LIMIT 1;

ALTER TABLE public.account_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "account_categories_select" ON public.account_categories
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "account_categories_write" ON public.account_categories
  FOR ALL USING (current_user_role() = 'admin');
