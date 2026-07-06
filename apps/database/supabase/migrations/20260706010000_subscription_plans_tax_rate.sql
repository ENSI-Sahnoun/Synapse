-- Per-plan TAX rate, added on top of price_dt at sale time.
ALTER TABLE public.subscription_plans
  ADD COLUMN tax_rate_pct numeric NOT NULL DEFAULT 0
    CHECK (tax_rate_pct >= 0 AND tax_rate_pct <= 100);
