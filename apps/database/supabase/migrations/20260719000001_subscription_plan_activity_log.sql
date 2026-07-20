-- apps/database/supabase/migrations/20260719000000_subscription_plan_activity_log.sql
-- Tracks subscription plan changes (price, duration, etc.) so admin can see
-- what a plan's price used to be, who changed it, and when — mirrors
-- pos_activity_log's product_update tracking for products.

CREATE TABLE public.subscription_plan_activity_log (
  id         uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  action     text        NOT NULL CHECK (action IN ('plan_create', 'plan_update')),
  plan_id    uuid        REFERENCES public.subscription_plans(id),
  actor_id   uuid        NOT NULL REFERENCES public.profiles(id),
  details    jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX subscription_plan_activity_log_created_at_idx
  ON public.subscription_plan_activity_log (created_at DESC);
CREATE INDEX subscription_plan_activity_log_plan_id_idx
  ON public.subscription_plan_activity_log (plan_id);

ALTER TABLE public.subscription_plan_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscription_plan_activity_log_admin_select"
  ON public.subscription_plan_activity_log FOR SELECT TO authenticated
  USING (public.current_user_role() = 'admin');
