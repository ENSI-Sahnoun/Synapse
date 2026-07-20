-- apps/database/supabase/migrations/20260719010000_purchases_subscriptions_voided.sql
-- Soft-delete columns for admin corrections: a voided purchase/subscription
-- stays visible in the transaction log (for audit) but is excluded from
-- revenue/analytics aggregates.

ALTER TABLE public.purchases
  ADD COLUMN voided_at timestamptz,
  ADD COLUMN voided_by uuid REFERENCES public.profiles(id);

ALTER TABLE public.subscriptions
  ADD COLUMN voided_at timestamptz,
  ADD COLUMN voided_by uuid REFERENCES public.profiles(id);

CREATE INDEX purchases_voided_at_idx ON public.purchases (voided_at) WHERE voided_at IS NOT NULL;
CREATE INDEX subscriptions_voided_at_idx ON public.subscriptions (voided_at) WHERE voided_at IS NOT NULL;
