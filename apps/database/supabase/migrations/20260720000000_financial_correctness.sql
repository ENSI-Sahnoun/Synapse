-- apps/database/supabase/migrations/20260720000000_financial_correctness.sql
--
-- Corrects four defects that made displayed financial figures wrong, plus the
-- day-boundary convention underneath all of them.
--
-- 1. DAY BOUNDARIES. `created_at` is timestamptz; comparing it to a bare `date`
--    casts that date at the session timezone, which is UTC on Supabase. The
--    business runs Africa/Tunis (UTC+1), so 00:00–01:00 of every business day
--    was attributed to the previous day — and to the previous *month* on the
--    1st, the range the dashboard defaults to. Every window below is now
--    anchored with `AT TIME ZONE 'Africa/Tunis'`.
--
-- 2. DISCOUNTS. 20260718010000 stores the cashier discount on the purchase
--    header only; line items keep full price. `analytics_cogs.revenue` summed
--    line items, so it reported revenue GROSS of discount, while the treasury,
--    cash-flow chart and revenue-split chart all summed `purchases.total_dt`
--    (net). Two POS revenue figures rendered side by side on one tab. Revenue
--    is now sourced from the header everywhere; per-product margin allocates
--    the discount pro-rata across that purchase's lines.
--
-- 3. UNBOUNDED SUMS. `getCapitalBalances` fetched every historical row of four
--    tables and summed in JS, with `max_rows = 1000` set in config.toml — past
--    1000 purchases the treasury balance silently froze revenue while expenses
--    kept accruing, drifting the Caisse figure toward negative with no error.
--    Aggregation moves into SQL.
--
-- 4. CASH RECONCILIATION. `pos_close_session` computed expected cash from
--    `purchases` alone. A subscription sold at the till therefore produced a
--    phantom surplus, which 20260710000002 auto-posted as a NEGATIVE expense —
--    booking that revenue a second time. Expected cash now covers every stream
--    that puts notes in the drawer.

-- ---------------------------------------------------------------------------
-- 1. COGS + revenue, Tunis-anchored and net of discount
-- ---------------------------------------------------------------------------

-- Return type gains a `discounts` column, so the function must be dropped
-- rather than replaced.
DROP FUNCTION IF EXISTS public.analytics_cogs(date, date);

CREATE FUNCTION public.analytics_cogs(p_from date, p_to date)
RETURNS TABLE (cogs numeric, revenue numeric, discounts numeric, missing_cost_products int)
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
    -- COGS still comes from the lines: it is a per-unit cost, unaffected by a
    -- header-level discount.
    COALESCE((
      SELECT SUM(pi.quantity * COALESCE(pr.cost_price, 0))
      FROM public.purchase_items pi
      JOIN public.purchases p ON p.id = pi.purchase_id
      JOIN public.products pr ON pr.id = pi.product_id
      WHERE p.created_at >= v_lo AND p.created_at < v_hi
    ), 0),
    -- Revenue is what was actually collected: the header total, already net.
    COALESCE((
      SELECT SUM(p.total_dt) FROM public.purchases p
      WHERE p.created_at >= v_lo AND p.created_at < v_hi
    ), 0),
    -- Surfaced as its own figure: discounts granted is a control metric, not
    -- something to bury inside a revenue number.
    COALESCE((
      SELECT SUM(p.discount_dt) FROM public.purchases p
      WHERE p.created_at >= v_lo AND p.created_at < v_hi
    ), 0),
    COALESCE((
      SELECT COUNT(DISTINCT pr.id) FILTER (WHERE pr.cost_price IS NULL)
      FROM public.purchase_items pi
      JOIN public.purchases p ON p.id = pi.purchase_id
      JOIN public.products pr ON pr.id = pi.product_id
      WHERE p.created_at >= v_lo AND p.created_at < v_hi
    ), 0)::int;
END;
$$;

GRANT EXECUTE ON FUNCTION public.analytics_cogs(date, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Per-product margin with pro-rata discount allocation
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.analytics_product_margin(p_from date, p_to date)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  quantity_sold bigint,
  revenue numeric,
  cogs numeric,
  margin numeric,
  cost_missing boolean
)
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
  WITH scoped AS (
    SELECT pi.purchase_id, pi.product_id, pi.quantity, pi.unit_price_dt, p.discount_dt
    FROM public.purchase_items pi
    JOIN public.purchases p ON p.id = pi.purchase_id
    WHERE p.created_at >= v_lo AND p.created_at < v_hi
  ),
  header AS (
    SELECT purchase_id,
           SUM(quantity * unit_price_dt) AS gross_dt,
           MAX(discount_dt)              AS discount_dt
    FROM scoped
    GROUP BY purchase_id
  ),
  lines AS (
    SELECT
      s.product_id,
      s.quantity,
      -- A 10 DT discount on a 100 DT basket takes 10% off every line, so each
      -- product carries its fair share of the give-away instead of one
      -- arbitrary line absorbing all of it.
      s.quantity * s.unit_price_dt
        * (1 - COALESCE(h.discount_dt, 0) / NULLIF(h.gross_dt, 0)) AS net_revenue
    FROM scoped s
    JOIN header h ON h.purchase_id = s.purchase_id
  )
  SELECT
    pr.id,
    pr.name,
    SUM(l.quantity)::bigint,
    COALESCE(SUM(l.net_revenue), 0),
    COALESCE(SUM(l.quantity * COALESCE(pr.cost_price, 0)), 0),
    COALESCE(SUM(l.net_revenue), 0) - COALESCE(SUM(l.quantity * COALESCE(pr.cost_price, 0)), 0),
    bool_or(pr.cost_price IS NULL)
  FROM lines l
  JOIN public.products pr ON pr.id = l.product_id
  GROUP BY pr.id, pr.name
  ORDER BY 6 DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.analytics_product_margin(date, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Peak hours in local wall-clock time
-- ---------------------------------------------------------------------------

-- `EXTRACT(HOUR FROM timestamptz)` reads UTC, so the reported busy hour was
-- shifted one hour earlier than the hour staff actually experienced.
CREATE OR REPLACE FUNCTION public.analytics_peak_hours(p_from date, p_to date)
RETURNS TABLE (weekday int, hour int, visits bigint)
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
    EXTRACT(DOW  FROM (a.checked_in_at AT TIME ZONE 'Africa/Tunis'))::int,
    EXTRACT(HOUR FROM (a.checked_in_at AT TIME ZONE 'Africa/Tunis'))::int,
    COUNT(*)::bigint
  FROM public.attendance a
  WHERE a.checked_in_at >= v_lo AND a.checked_in_at < v_hi
  GROUP BY 1, 2
  ORDER BY 1, 2;
END;
$$;

GRANT EXECUTE ON FUNCTION public.analytics_peak_hours(date, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. All-time treasury totals, aggregated in SQL
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.analytics_capital_totals()
RETURNS TABLE (subs numeric, pos numeric, lockers numeric, expenses numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs';
  END IF;

  RETURN QUERY SELECT
    COALESCE((SELECT SUM(paid_amount) FROM public.subscriptions),   0),
    COALESCE((SELECT SUM(total_dt)    FROM public.purchases),       0),
    COALESCE((SELECT SUM(amount_dt)   FROM public.locker_payments), 0),
    COALESCE((SELECT SUM(amount_dt)   FROM public.expenses),        0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.analytics_capital_totals() TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Subscription status counted per MEMBER, not per row
-- ---------------------------------------------------------------------------

-- The JS version classified every subscription row, so a member on their sixth
-- renewal contributed five to `expired` and one to `active`. The expired count
-- therefore climbed steadily for a *healthy* gym with loyal members. One member
-- now yields exactly one status, taken from their latest subscription.
CREATE OR REPLACE FUNCTION public.analytics_subscription_status(p_as_of date, p_soon_days int DEFAULT 7)
RETURNS TABLE (active bigint, expiring_soon bigint, expired bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs';
  END IF;

  RETURN QUERY
  WITH latest AS (
    SELECT DISTINCT ON (student_id) student_id, end_date
    FROM public.subscriptions
    ORDER BY student_id, end_date DESC
  )
  SELECT
    COUNT(*) FILTER (WHERE end_date > p_as_of + p_soon_days),
    COUNT(*) FILTER (WHERE end_date >= p_as_of AND end_date <= p_as_of + p_soon_days),
    COUNT(*) FILTER (WHERE end_date < p_as_of)
  FROM latest;
END;
$$;

GRANT EXECUTE ON FUNCTION public.analytics_subscription_status(date, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.analytics_plan_popularity()
RETURNS TABLE (plan_name text, sold bigint, revenue numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs';
  END IF;

  RETURN QUERY
  SELECT sp.name, COUNT(s.id)::bigint, COALESCE(SUM(s.paid_amount), 0)
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON sp.id = s.plan_id
  GROUP BY sp.name
  ORDER BY 2 DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.analytics_plan_popularity() TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Cash session expected amount covers every cash stream
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pos_close_session(
  p_session_id     uuid,
  p_closing_amount numeric,
  p_notes          text
)
RETURNS public.cash_register_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id      uuid := auth.uid();
  v_session       public.cash_register_sessions;
  v_movements_in  numeric := 0;
  v_movements_out numeric := 0;
  v_sales         numeric := 0;
  v_subs          numeric := 0;
  v_lockers       numeric := 0;
  v_expected      numeric;
  v_closed_at     timestamptz := now();
  v_discrepancy_category_id uuid;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  SELECT * INTO v_session
    FROM public.cash_register_sessions
   WHERE id = p_session_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session de caisse introuvable';
  END IF;

  IF v_session.status <> 'open' THEN
    RAISE EXCEPTION 'La session de caisse est déjà clôturée';
  END IF;

  SELECT COALESCE(SUM(amount_dt), 0) INTO v_movements_in
    FROM public.cash_movements
   WHERE session_id = p_session_id AND type = 'in';

  SELECT COALESCE(SUM(amount_dt), 0) INTO v_movements_out
    FROM public.cash_movements
   WHERE session_id = p_session_id AND type = 'out';

  SELECT COALESCE(SUM(total_dt), 0) INTO v_sales
    FROM public.purchases
   WHERE created_at >= v_session.opened_at AND created_at <= v_closed_at;

  -- Subscriptions and locker fees are taken in cash at the same counter and
  -- land in the same drawer. Excluding them made every session that sold a
  -- subscription report a surplus equal to that subscription, which was then
  -- auto-posted as a negative expense — counting the revenue twice.
  SELECT COALESCE(SUM(paid_amount), 0) INTO v_subs
    FROM public.subscriptions
   WHERE created_at >= v_session.opened_at AND created_at <= v_closed_at;

  SELECT COALESCE(SUM(amount_dt), 0) INTO v_lockers
    FROM public.locker_payments
   WHERE created_at >= v_session.opened_at AND created_at <= v_closed_at;

  v_expected := v_session.opening_amount_dt
              + v_movements_in - v_movements_out
              + v_sales + v_subs + v_lockers;

  UPDATE public.cash_register_sessions
     SET status             = 'closed',
         closed_by          = v_actor_id,
         closed_at          = v_closed_at,
         closing_amount_dt  = p_closing_amount,
         expected_amount_dt = v_expected,
         discrepancy_dt     = p_closing_amount - v_expected,
         notes              = p_notes
   WHERE id = p_session_id
   RETURNING * INTO v_session;

  IF v_session.discrepancy_dt <> 0 THEN
    SELECT id INTO v_discrepancy_category_id
      FROM public.account_categories
     WHERE id = '00000000-0000-0000-0000-0000000000ec';

    INSERT INTO public.expenses (account_category_id, description, amount_dt, date, created_by)
    VALUES (
      v_discrepancy_category_id,
      'Écart de caisse — session clôturée le '
        || to_char(v_closed_at AT TIME ZONE 'Africa/Tunis', 'DD/MM/YYYY HH24:MI'),
      -v_session.discrepancy_dt,
      (v_closed_at AT TIME ZONE 'Africa/Tunis')::date,
      v_actor_id
    );
  END IF;

  RETURN v_session;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pos_close_session(uuid, numeric, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
