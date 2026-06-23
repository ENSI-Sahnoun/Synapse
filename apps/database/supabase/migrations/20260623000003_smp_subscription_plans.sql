-- apps/database/supabase/migrations/20260623000003_smp_subscription_plans.sql

CREATE TABLE public.subscription_plans (
  id            uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name          text        NOT NULL,
  duration_days int         NOT NULL CHECK (duration_days > 0),
  price_dt      numeric     NOT NULL CHECK (price_dt >= 0),
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed default plans matching Synapse pricing
INSERT INTO public.subscription_plans (name, duration_days, price_dt) VALUES
  ('Journalier',     1,   6),
  ('Demi-journée',   1,   5),
  ('Semaine',        7,  25),
  ('Deux semaines', 14,  40),
  ('Mensuel',       30,  70),
  ('Trimestriel',   90, 180);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read active plans
CREATE POLICY "subscription_plans_select" ON public.subscription_plans
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Admin only: insert/update/delete
CREATE POLICY "subscription_plans_insert" ON public.subscription_plans
  FOR INSERT WITH CHECK (current_user_role() = 'admin');

CREATE POLICY "subscription_plans_update" ON public.subscription_plans
  FOR UPDATE USING (current_user_role() = 'admin');

CREATE POLICY "subscription_plans_delete" ON public.subscription_plans
  FOR DELETE USING (current_user_role() = 'admin');
