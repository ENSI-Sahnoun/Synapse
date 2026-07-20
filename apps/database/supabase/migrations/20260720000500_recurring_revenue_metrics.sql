-- apps/database/supabase/migrations/20260720000500_recurring_revenue_metrics.sql
--
-- The membership-business metrics the platform had no way to express.
--
-- Everything here is aggregated in SQL rather than JS on purpose: these queries
-- span all-time subscription history, and `max_rows = 1000` in config.toml
-- silently truncates row fetches — the same trap that had the treasury balance
-- drifting.
--
-- Subscription duration is taken as `end_date - start_date` rather than the
-- plan's `duration_days`, because subscriptions can be edited (and are, by
-- `updateSubscriptionAction`) and a refund now shortens `end_date`. The row's
-- own dates are the truth about what the member actually bought.

-- ---------------------------------------------------------------------------
-- 1. Recurring revenue: MRR, ARR, deferred revenue, recognised revenue
-- ---------------------------------------------------------------------------

-- Average days per month across a Gregorian 400-year cycle. Using 30 skews MRR
-- up by ~1.5%, which compounds visibly in an ARR figure.
CREATE OR REPLACE FUNCTION public.avg_days_per_month() RETURNS numeric
LANGUAGE sql IMMUTABLE AS $$ SELECT 30.4375::numeric $$;

CREATE OR REPLACE FUNCTION public.analytics_recurring_revenue(p_as_of date)
RETURNS TABLE (
  mrr                numeric,
  arr                numeric,
  active_members     bigint,
  arpu               numeric,
  deferred_revenue   numeric,
  revenue_at_risk_30 numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs';
  END IF;

  RETURN QUERY
  WITH active AS (
    SELECT
      s.student_id,
      s.paid_amount,
      s.end_date,
      GREATEST((s.end_date - s.start_date), 1) AS duration_days,
      GREATEST((s.end_date - GREATEST(s.start_date, p_as_of)), 0) AS remaining_days
    FROM public.subscriptions s
    WHERE s.start_date <= p_as_of AND s.end_date >= p_as_of
  )
  SELECT
    -- Normalised monthly value of every live membership. A 12-month plan and
    -- twelve monthly plans contribute the same MRR, which is the entire point:
    -- lump-sum cash on sale day makes one month look spectacular and the next
    -- look dead, and nothing in this system could see through that.
    COALESCE(SUM(a.paid_amount / a.duration_days * public.avg_days_per_month()), 0),
    COALESCE(SUM(a.paid_amount / a.duration_days * public.avg_days_per_month()), 0) * 12,
    COUNT(DISTINCT a.student_id)::bigint,
    CASE WHEN COUNT(DISTINCT a.student_id) > 0
         THEN COALESCE(SUM(a.paid_amount / a.duration_days * public.avg_days_per_month()), 0)
              / COUNT(DISTINCT a.student_id)
         ELSE 0 END,
    -- Unearned revenue: cash already collected for days not yet delivered. It
    -- is a liability, not profit — and the treasury currently presents it as
    -- spendable cash.
    COALESCE(SUM(a.paid_amount * a.remaining_days / a.duration_days), 0),
    -- Value of memberships lapsing within 30 days.
    COALESCE(SUM(a.paid_amount) FILTER (WHERE a.end_date <= p_as_of + 30), 0)
  FROM active a;
END;
$$;

GRANT EXECUTE ON FUNCTION public.analytics_recurring_revenue(date) TO authenticated;

-- Accrual-basis subscription revenue: the portion of each membership actually
-- delivered inside the window, regardless of when it was paid for.
CREATE OR REPLACE FUNCTION public.analytics_recognized_revenue(p_from date, p_to date)
RETURNS TABLE (recognized numeric, cash_collected numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lo timestamptz := (p_from::timestamp AT TIME ZONE 'Africa/Tunis');
  v_hi timestamptz := ((p_to + 1)::timestamp AT TIME ZONE 'Africa/Tunis');
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE((
      SELECT SUM(
        s.paid_amount
        * (LEAST(s.end_date, p_to) - GREATEST(s.start_date, p_from) + 1)::numeric
        / GREATEST((s.end_date - s.start_date), 1)
      )
      FROM public.subscriptions s
      -- Any membership whose service period overlaps the window at all.
      WHERE s.start_date <= p_to AND s.end_date >= p_from
    ), 0),
    COALESCE((
      SELECT SUM(s.paid_amount) FROM public.subscriptions s
      WHERE s.created_at >= v_lo AND s.created_at < v_hi
    ), 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.analytics_recognized_revenue(date, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Churn, retention, lifetime
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.analytics_churn(p_from date, p_to date)
RETURNS TABLE (
  cohort            bigint,
  renewed           bigint,
  churned           bigint,
  renewal_rate_pct  numeric,
  churn_rate_pct    numeric,
  avg_lifetime_days numeric,
  ltv               numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs';
  END IF;

  RETURN QUERY
  WITH expiring AS (
    -- One row per member whose membership lapsed in the window. Distinct on
    -- student because a member with several historical subscriptions is still
    -- one churn decision — the un-deduplicated version counted them repeatedly
    -- and therefore trended upward for a HEALTHY gym with loyal members.
    SELECT DISTINCT ON (s.student_id) s.student_id, s.end_date
    FROM public.subscriptions s
    WHERE s.end_date >= p_from AND s.end_date <= p_to
    ORDER BY s.student_id, s.end_date DESC
  ),
  judged AS (
    SELECT
      e.student_id,
      EXISTS (
        SELECT 1 FROM public.subscriptions n
        WHERE n.student_id = e.student_id
          -- Renewals are rarely punctual: someone may re-up a few days early
          -- or drift a few weeks late. A tight window would score ordinary
          -- behaviour as churn.
          AND n.start_date BETWEEN e.end_date - 7 AND e.end_date + 30
          AND n.start_date > e.end_date - 7
      ) AS renewed
    FROM expiring e
  ),
  lifetimes AS (
    SELECT s.student_id,
           (MAX(s.end_date) - MIN(s.start_date))::numeric AS days,
           SUM(s.paid_amount) AS spend
    FROM public.subscriptions s
    GROUP BY s.student_id
  )
  SELECT
    (SELECT COUNT(*) FROM judged)::bigint,
    (SELECT COUNT(*) FROM judged WHERE renewed)::bigint,
    (SELECT COUNT(*) FROM judged WHERE NOT renewed)::bigint,
    CASE WHEN (SELECT COUNT(*) FROM judged) > 0
         THEN (SELECT COUNT(*) FROM judged WHERE renewed)::numeric
              / (SELECT COUNT(*) FROM judged) * 100
         ELSE NULL END,
    CASE WHEN (SELECT COUNT(*) FROM judged) > 0
         THEN (SELECT COUNT(*) FROM judged WHERE NOT renewed)::numeric
              / (SELECT COUNT(*) FROM judged) * 100
         ELSE NULL END,
    (SELECT COALESCE(AVG(days), 0) FROM lifetimes),
    -- Observed lifetime value: what a member has actually spent on
    -- memberships, averaged. Preferred over the ARPU/churn projection, which
    -- explodes toward infinity whenever a period happens to record zero churn.
    (SELECT COALESCE(AVG(spend), 0) FROM lifetimes);
END;
$$;

GRANT EXECUTE ON FUNCTION public.analytics_churn(date, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Inventory as an asset
-- ---------------------------------------------------------------------------

-- `cost_price` existed but was only ever read for units already SOLD. Nothing
-- multiplied it by stock on hand, so the owner could not see how much money was
-- sitting on the shelves, and the treasury understated total assets by the whole
-- inventory.
CREATE OR REPLACE FUNCTION public.analytics_inventory_valuation()
RETURNS TABLE (
  inventory_value_dt   numeric,
  retail_value_dt      numeric,
  sku_count            bigint,
  units_on_hand        bigint,
  missing_cost_count   bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(p.stock_quantity * COALESCE(p.cost_price, 0)), 0),
    COALESCE(SUM(p.stock_quantity * p.price_dt), 0),
    COUNT(*)::bigint,
    COALESCE(SUM(p.stock_quantity), 0)::bigint,
    COUNT(*) FILTER (WHERE p.cost_price IS NULL)::bigint
  FROM public.products p
  WHERE p.is_active AND p.stock_quantity > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.analytics_inventory_valuation() TO authenticated;

-- Capital tied up in products that are not moving. `getBestSellers` can only
-- rank what DID sell, so slow movers were structurally invisible.
CREATE OR REPLACE FUNCTION public.analytics_dead_stock(p_days int DEFAULT 60)
RETURNS TABLE (
  product_id      uuid,
  product_name    text,
  stock_quantity  int,
  tied_up_dt      numeric,
  last_sold_at    timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs';
  END IF;

  RETURN QUERY
  SELECT
    p.id, p.name, p.stock_quantity,
    p.stock_quantity * COALESCE(p.cost_price, 0),
    (SELECT MAX(pu.created_at)
       FROM public.purchase_items pi
       JOIN public.purchases pu ON pu.id = pi.purchase_id
      WHERE pi.product_id = p.id)
  FROM public.products p
  WHERE p.is_active
    AND p.stock_quantity > 0
    AND NOT EXISTS (
      SELECT 1
      FROM public.purchase_items pi
      JOIN public.purchases pu ON pu.id = pi.purchase_id
      WHERE pi.product_id = p.id
        AND pu.created_at >= now() - make_interval(days => p_days)
    )
  ORDER BY 4 DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.analytics_dead_stock(int) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. POS basket economics
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.analytics_basket(p_from date, p_to date)
RETURNS TABLE (
  transactions        bigint,
  avg_basket_dt       numeric,
  avg_items_per_basket numeric,
  discount_total_dt   numeric,
  discount_rate_pct   numeric,
  discounted_baskets  bigint,
  attach_rate_pct     numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lo timestamptz := (p_from::timestamp AT TIME ZONE 'Africa/Tunis');
  v_hi timestamptz := ((p_to + 1)::timestamp AT TIME ZONE 'Africa/Tunis');
  v_visits bigint;
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs';
  END IF;

  SELECT COUNT(*) INTO v_visits
    FROM public.attendance a
   WHERE a.checked_in_at >= v_lo AND a.checked_in_at < v_hi;

  RETURN QUERY
  WITH baskets AS (
    SELECT
      p.id, p.total_dt, p.discount_dt,
      (SELECT COALESCE(SUM(pi.quantity), 0) FROM public.purchase_items pi WHERE pi.purchase_id = p.id) AS items
    FROM public.purchases p
    WHERE p.created_at >= v_lo AND p.created_at < v_hi
  )
  SELECT
    COUNT(*)::bigint,
    COALESCE(AVG(total_dt), 0),
    COALESCE(AVG(items), 0),
    COALESCE(SUM(discount_dt), 0),
    -- Discount leakage as a share of what the basket would have fetched at
    -- list price. Unmonitored cashier discounting is a classic retail leak.
    CASE WHEN COALESCE(SUM(total_dt + discount_dt), 0) > 0
         THEN COALESCE(SUM(discount_dt), 0) / SUM(total_dt + discount_dt) * 100
         ELSE 0 END,
    COUNT(*) FILTER (WHERE discount_dt > 0)::bigint,
    -- Attach rate: share of member visits that also bought something. Ties the
    -- shop to footfall, which is the lever the owner can actually pull.
    CASE WHEN v_visits > 0 THEN COUNT(*)::numeric / v_visits * 100 ELSE NULL END
  FROM baskets;
END;
$$;

GRANT EXECUTE ON FUNCTION public.analytics_basket(date, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Break-even and contribution margin
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.analytics_breakeven(p_from date, p_to date)
RETURNS TABLE (
  revenue_dt              numeric,
  variable_cost_dt        numeric,
  fixed_cost_dt           numeric,
  contribution_margin_dt  numeric,
  contribution_margin_pct numeric,
  breakeven_revenue_dt    numeric,
  margin_of_safety_pct    numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lo timestamptz := (p_from::timestamp AT TIME ZONE 'Africa/Tunis');
  v_hi timestamptz := ((p_to + 1)::timestamp AT TIME ZONE 'Africa/Tunis');
  v_revenue  numeric;
  v_cogs     numeric;
  v_variable numeric;
  v_fixed    numeric;
  v_cm       numeric;
  v_cm_pct   numeric;
  v_be       numeric;
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs';
  END IF;

  SELECT
    COALESCE((SELECT SUM(paid_amount) FROM public.subscriptions
               WHERE created_at >= v_lo AND created_at < v_hi), 0)
  + COALESCE((SELECT SUM(total_dt) FROM public.purchases
               WHERE created_at >= v_lo AND created_at < v_hi), 0)
  + COALESCE((SELECT SUM(amount_dt) FROM public.locker_payments
               WHERE created_at >= v_lo AND created_at < v_hi), 0)
  - COALESCE((SELECT SUM(amount_dt) FROM public.refunds
               WHERE created_at >= v_lo AND created_at < v_hi), 0)
  INTO v_revenue;

  -- COGS is variable by definition: no sale, no cost.
  SELECT COALESCE(SUM(pi.quantity * COALESCE(pr.cost_price, 0)), 0)
    INTO v_cogs
    FROM public.purchase_items pi
    JOIN public.purchases p ON p.id = pi.purchase_id
    JOIN public.products pr ON pr.id = pi.product_id
   WHERE p.created_at >= v_lo AND p.created_at < v_hi;

  SELECT
    COALESCE(SUM(e.amount_dt) FILTER (WHERE ac.cost_behavior = 'variable'), 0),
    COALESCE(SUM(e.amount_dt) FILTER (WHERE ac.cost_behavior = 'fixed'), 0)
    INTO v_variable, v_fixed
    FROM public.expenses e
    JOIN public.account_categories ac ON ac.id = e.account_category_id
   WHERE e.date >= p_from AND e.date <= p_to;

  v_variable := v_variable + v_cogs;
  v_cm       := v_revenue - v_variable;
  v_cm_pct   := CASE WHEN v_revenue > 0 THEN v_cm / v_revenue * 100 ELSE NULL END;
  -- Revenue needed to cover fixed costs at the current contribution margin.
  -- Undefined when the margin is zero or negative: no revenue level breaks
  -- even if every extra sale loses money.
  v_be       := CASE WHEN v_cm > 0 THEN v_fixed / (v_cm / v_revenue) ELSE NULL END;

  RETURN QUERY SELECT
    v_revenue, v_variable, v_fixed, v_cm, v_cm_pct, v_be,
    CASE WHEN v_be IS NOT NULL AND v_revenue > 0
         THEN (v_revenue - v_be) / v_revenue * 100
         ELSE NULL END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.analytics_breakeven(date, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Burn rate and runway
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.analytics_runway(p_months int DEFAULT 3)
RETURNS TABLE (
  avg_monthly_inflow   numeric,
  avg_monthly_outflow  numeric,
  net_burn_dt          numeric,
  runway_months        numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Africa/Tunis')::date;
  v_start date := (date_trunc('month', v_today) - make_interval(months => p_months))::date;
  v_lo timestamptz := (v_start::timestamp AT TIME ZONE 'Africa/Tunis');
  v_in  numeric;
  v_out numeric;
  v_cash numeric;
  v_burn numeric;
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs';
  END IF;

  SELECT
    COALESCE((SELECT SUM(paid_amount) FROM public.subscriptions   WHERE created_at >= v_lo), 0)
  + COALESCE((SELECT SUM(total_dt)    FROM public.purchases       WHERE created_at >= v_lo), 0)
  + COALESCE((SELECT SUM(amount_dt)   FROM public.locker_payments WHERE created_at >= v_lo), 0)
  - COALESCE((SELECT SUM(amount_dt)   FROM public.refunds         WHERE created_at >= v_lo), 0)
  INTO v_in;

  SELECT COALESCE(SUM(amount_dt), 0) INTO v_out
    FROM public.expenses WHERE date >= v_start;

  SELECT COALESCE(SUM(subs + pos + lockers - expenses - refunds), 0) INTO v_cash
    FROM public.analytics_capital_totals();

  v_burn := (v_out - v_in) / GREATEST(p_months, 1);

  RETURN QUERY SELECT
    v_in / GREATEST(p_months, 1),
    v_out / GREATEST(p_months, 1),
    v_burn,
    -- Only meaningful while burning cash. A profitable business has infinite
    -- runway, which must render as "—" rather than a negative month count.
    CASE WHEN v_burn > 0 THEN v_cash / v_burn ELSE NULL END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.analytics_runway(int) TO authenticated;

NOTIFY pgrst, 'reload schema';
