-- apps/database/supabase/migrations/20260720000200_tva.sql
--
-- TVA (Tunisian VAT) separation.
--
-- `subscription_plans.tax_rate_pct` has existed since 20260706010000 but is
-- read nowhere — not by the P&L, not by any report. Products carry no rate at
-- all. Every reported figure is therefore TTC (tax-inclusive) while being
-- labelled "revenus" and "bénéfice net", which overstates both: the TVA
-- collected on a sale is money held on behalf of the state, not income.
--
-- Convention: displayed prices are TTC, as is standard in Tunisian retail.
-- The tax inside a TTC amount is `amount * rate / (100 + rate)`, NOT
-- `amount * rate / 100` — a 19% rate on a 119 DT sale is 19 DT, not 22.61.
-- Getting this backwards is the single most common VAT bug, so the extraction
-- lives in one function that everything else calls.

-- Standard Tunisian rate. Configurable because reduced rates (7%, 13%) apply
-- to some goods, and because the rate itself changes by finance act.
INSERT INTO public.settings (key, value)
SELECT 'default_tva_rate_pct', '19'
WHERE NOT EXISTS (SELECT 1 FROM public.settings WHERE key = 'default_tva_rate_pct');

-- 0 means "not subject to TVA" and is the safe default: it makes this
-- migration a no-op for reporting until rates are deliberately set, rather
-- than silently restating history at 19%.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS tax_rate_pct numeric NOT NULL DEFAULT 0
    CHECK (tax_rate_pct >= 0 AND tax_rate_pct < 100);

-- Input TVA on purchases from suppliers is deductible against output TVA. The
-- rate lives on the expense category because that is the granularity at which
-- the owner already classifies spending.
ALTER TABLE public.account_categories
  ADD COLUMN IF NOT EXISTS tax_rate_pct numeric NOT NULL DEFAULT 0
    CHECK (tax_rate_pct >= 0 AND tax_rate_pct < 100);

-- Cost behaviour, needed for break-even: contribution margin requires knowing
-- which costs scale with volume and which do not. Rent is fixed, supplier
-- restocking is variable.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cost_behavior') THEN
    CREATE TYPE public.cost_behavior AS ENUM ('fixed', 'variable');
  END IF;
END;
$$;

ALTER TABLE public.account_categories
  ADD COLUMN IF NOT EXISTS cost_behavior public.cost_behavior NOT NULL DEFAULT 'fixed';

-- Tax contained in a TTC amount.
CREATE OR REPLACE FUNCTION public.tva_of_ttc(p_amount numeric, p_rate_pct numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN COALESCE(p_rate_pct, 0) <= 0 THEN 0
    ELSE COALESCE(p_amount, 0) * p_rate_pct / (100 + p_rate_pct)
  END;
$$;

-- Amount excluding tax (HT) from a TTC amount.
CREATE OR REPLACE FUNCTION public.ht_of_ttc(p_amount numeric, p_rate_pct numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(p_amount, 0) - public.tva_of_ttc(p_amount, p_rate_pct);
$$;

-- TVA declaration for a period: what was collected on sales, what is
-- deductible on purchases, and the net owed to the state.
CREATE OR REPLACE FUNCTION public.analytics_tva(p_from date, p_to date)
RETURNS TABLE (
  revenue_ttc      numeric,
  revenue_ht       numeric,
  tva_collected    numeric,
  tva_deductible   numeric,
  tva_net_payable  numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lo timestamptz := (p_from::timestamp AT TIME ZONE 'Africa/Tunis');
  v_hi timestamptz := ((p_to + 1)::timestamp AT TIME ZONE 'Africa/Tunis');
  v_subs_ttc      numeric := 0;
  v_subs_tva      numeric := 0;
  v_pos_ttc       numeric := 0;
  v_pos_tva       numeric := 0;
  v_refund_tva    numeric := 0;
  v_deductible    numeric := 0;
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs';
  END IF;

  -- Subscriptions: rate comes from the plan. `paid_amount` may differ from the
  -- plan price after a discount, so tax is extracted from what was actually
  -- collected, not from the list price.
  SELECT COALESCE(SUM(s.paid_amount), 0),
         COALESCE(SUM(public.tva_of_ttc(s.paid_amount, sp.tax_rate_pct)), 0)
    INTO v_subs_ttc, v_subs_tva
    FROM public.subscriptions s
    JOIN public.subscription_plans sp ON sp.id = s.plan_id
   WHERE s.created_at >= v_lo AND s.created_at < v_hi;

  -- POS: per-line rates, with the header discount allocated pro-rata so the
  -- tax base matches the amount actually collected.
  WITH scoped AS (
    SELECT pi.purchase_id, pi.quantity, pi.unit_price_dt, pr.tax_rate_pct, p.discount_dt
    FROM public.purchase_items pi
    JOIN public.purchases p ON p.id = pi.purchase_id
    JOIN public.products pr ON pr.id = pi.product_id
    WHERE p.created_at >= v_lo AND p.created_at < v_hi
  ),
  header AS (
    SELECT purchase_id, SUM(quantity * unit_price_dt) AS gross, MAX(discount_dt) AS discount
    FROM scoped GROUP BY purchase_id
  ),
  lines AS (
    SELECT s.tax_rate_pct,
           s.quantity * s.unit_price_dt
             * (1 - COALESCE(h.discount, 0) / NULLIF(h.gross, 0)) AS net_ttc
    FROM scoped s JOIN header h ON h.purchase_id = s.purchase_id
  )
  SELECT COALESCE(SUM(net_ttc), 0), COALESCE(SUM(public.tva_of_ttc(net_ttc, tax_rate_pct)), 0)
    INTO v_pos_ttc, v_pos_tva
    FROM lines;

  -- Refunds reverse output TVA. Rate is resolved per source; locker fees carry
  -- the default rate since they have no per-item rate of their own.
  SELECT COALESCE(SUM(
    CASE r.source
      WHEN 'subscription' THEN public.tva_of_ttc(r.amount_dt, sp.tax_rate_pct)
      WHEN 'purchase'     THEN public.tva_of_ttc(r.amount_dt,
                                (SELECT COALESCE(AVG(pr.tax_rate_pct), 0)
                                   FROM public.purchase_items pi
                                   JOIN public.products pr ON pr.id = pi.product_id
                                  WHERE pi.purchase_id = r.purchase_id))
      ELSE 0
    END), 0)
    INTO v_refund_tva
    FROM public.refunds r
    LEFT JOIN public.subscriptions s  ON s.id = r.subscription_id
    LEFT JOIN public.subscription_plans sp ON sp.id = s.plan_id
   WHERE r.created_at >= v_lo AND r.created_at < v_hi;

  -- Input TVA on expenses, by category rate.
  SELECT COALESCE(SUM(public.tva_of_ttc(e.amount_dt, ac.tax_rate_pct)), 0)
    INTO v_deductible
    FROM public.expenses e
    JOIN public.account_categories ac ON ac.id = e.account_category_id
   WHERE e.date >= p_from AND e.date <= p_to;

  RETURN QUERY SELECT
    (v_subs_ttc + v_pos_ttc),
    (v_subs_ttc + v_pos_ttc) - (v_subs_tva + v_pos_tva - v_refund_tva),
    (v_subs_tva + v_pos_tva - v_refund_tva),
    v_deductible,
    (v_subs_tva + v_pos_tva - v_refund_tva) - v_deductible;
END;
$$;

GRANT EXECUTE ON FUNCTION public.analytics_tva(date, date) TO authenticated;

NOTIFY pgrst, 'reload schema';
