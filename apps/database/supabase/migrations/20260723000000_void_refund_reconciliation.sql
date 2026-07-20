-- apps/database/supabase/migrations/20260723000000_void_refund_reconciliation.sql
--
-- Void (pos_void_purchase) and refund (refund_purchase) are two distinct,
-- legitimate corrections and both stay:
--   * Void   — admin only. The sale itself was a mistake (wrong item, dupe
--     scan, test ring-up). It never happened: full stock back, zero revenue,
--     struck from the log.
--   * Refund — staff, ceiling-enforced, audited. The sale was real; money is
--     being handed back after the fact (return, complaint), partially or in
--     full. Restocking only happens when the refund closes out the total.
--
-- Two gaps from wiring void in without touching the rest of the financial
-- layer:
--
-- 1. Mutual exclusion. Nothing stopped a purchase from being both voided and
--    refunded — an admin could void a sale an employee had already refunded
--    and the customer gets paid twice for one purchase.
-- 2. Void-blind revenue. Every analytics/close-out function that reads
--    `purchases` predates voiding and has no `voided_at IS NULL` filter, so a
--    voided sale still counts as revenue, COGS and expected cash. The stock
--    rewind (getStockOverPeriod, app-side) double-counts on top of that: the
--    void's restock is already baked into current stock_quantity, but the
--    voided purchase_items rows are still read as a sale to reverse.

-- ---------------------------------------------------------------------------
-- 1. Mutual exclusion between void and refund
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pos_void_purchase(p_purchase_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_total_dt numeric;
  v_voided   timestamptz;
  v_refunded numeric;
  v_item     record;
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs';
  END IF;

  SELECT total_dt, voided_at INTO v_total_dt, v_voided
    FROM public.purchases WHERE id = p_purchase_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Achat introuvable';
  END IF;
  IF v_voided IS NOT NULL THEN
    RAISE EXCEPTION 'Achat déjà annulé';
  END IF;

  -- Money already handed back through a refund: voiding on top would restore
  -- stock a second time and erase revenue the customer was already repaid
  -- for out of. Undo the refund (there is no un-refund) before voiding, or
  -- leave the sale as refunded.
  v_refunded := public.refunded_total('purchase', p_purchase_id);
  IF v_refunded > 0 THEN
    RAISE EXCEPTION 'Achat déjà partiellement ou totalement remboursé, annulation impossible';
  END IF;

  FOR v_item IN
    SELECT product_id, quantity FROM public.purchase_items WHERE purchase_id = p_purchase_id
  LOOP
    UPDATE public.products
       SET stock_quantity = stock_quantity + v_item.quantity
     WHERE id = v_item.product_id;
  END LOOP;

  UPDATE public.purchases
     SET voided_at = now(), voided_by = v_actor_id
   WHERE id = p_purchase_id;

  INSERT INTO public.pos_activity_log (action, actor_id, amount_dt, details)
  VALUES ('purchase_void', v_actor_id, v_total_dt,
          jsonb_build_object('purchase_id', p_purchase_id));

  RETURN jsonb_build_object('purchase_id', p_purchase_id, 'voided', true, 'total_dt', v_total_dt);
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_purchase(
  p_purchase_id uuid,
  p_amount      numeric,
  p_reason      text,
  p_restock     boolean DEFAULT true
)
RETURNS public.refunds
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor    uuid := auth.uid();
  v_total    numeric;
  v_voided   timestamptz;
  v_refunded numeric;
  v_refund   public.refunds;
  v_item     record;
BEGIN
  IF v_actor IS NULL OR public.current_user_role() NOT IN ('admin', 'employee') THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Montant de remboursement invalide';
  END IF;

  SELECT total_dt, voided_at INTO v_total, v_voided FROM public.purchases WHERE id = p_purchase_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vente introuvable';
  END IF;
  -- A voided sale never happened: there is nothing left to refund. The admin
  -- who voided it by mistake reverses the void, not the refund.
  IF v_voided IS NOT NULL THEN
    RAISE EXCEPTION 'Achat annulé, remboursement impossible';
  END IF;

  v_refunded := public.refunded_total('purchase', p_purchase_id);
  IF v_refunded + p_amount > v_total THEN
    RAISE EXCEPTION 'Remboursement (%) supérieur au montant restant (%)',
      p_amount, v_total - v_refunded;
  END IF;

  IF p_restock AND (v_refunded + p_amount) = v_total THEN
    FOR v_item IN
      SELECT product_id, quantity FROM public.purchase_items WHERE purchase_id = p_purchase_id
    LOOP
      UPDATE public.products
         SET stock_quantity = stock_quantity + v_item.quantity
       WHERE id = v_item.product_id;
    END LOOP;
  END IF;

  INSERT INTO public.refunds (source, purchase_id, amount_dt, reason, restocked, created_by)
  VALUES ('purchase', p_purchase_id, p_amount, p_reason,
          p_restock AND (v_refunded + p_amount) = v_total, v_actor)
  RETURNING * INTO v_refund;

  RETURN v_refund;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Void-blind revenue: exclude voided purchases everywhere money is summed
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.analytics_cogs(p_from date, p_to date)
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
    COALESCE((
      SELECT SUM(pi.quantity * COALESCE(pr.cost_price, 0))
      FROM public.purchase_items pi
      JOIN public.purchases p ON p.id = pi.purchase_id
      JOIN public.products pr ON pr.id = pi.product_id
      WHERE p.created_at >= v_lo AND p.created_at < v_hi AND p.voided_at IS NULL
    ), 0),
    COALESCE((
      SELECT SUM(p.total_dt) FROM public.purchases p
      WHERE p.created_at >= v_lo AND p.created_at < v_hi AND p.voided_at IS NULL
    ), 0),
    COALESCE((
      SELECT SUM(p.discount_dt) FROM public.purchases p
      WHERE p.created_at >= v_lo AND p.created_at < v_hi AND p.voided_at IS NULL
    ), 0),
    COALESCE((
      SELECT COUNT(DISTINCT pr.id) FILTER (WHERE pr.cost_price IS NULL)
      FROM public.purchase_items pi
      JOIN public.purchases p ON p.id = pi.purchase_id
      JOIN public.products pr ON pr.id = pi.product_id
      WHERE p.created_at >= v_lo AND p.created_at < v_hi AND p.voided_at IS NULL
    ), 0)::int;
END;
$$;

CREATE OR REPLACE FUNCTION public.analytics_capital_totals()
RETURNS TABLE (subs numeric, pos numeric, lockers numeric, expenses numeric, refunds numeric)
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
    COALESCE((SELECT SUM(total_dt)    FROM public.purchases        WHERE voided_at IS NULL), 0),
    COALESCE((SELECT SUM(amount_dt)   FROM public.locker_payments), 0),
    COALESCE((SELECT SUM(amount_dt)   FROM public.expenses),        0),
    COALESCE((SELECT SUM(amount_dt)   FROM public.refunds),         0);
END;
$$;

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
    WHERE p.created_at >= v_lo AND p.created_at < v_hi AND p.voided_at IS NULL
  )
  SELECT
    COUNT(*)::bigint,
    COALESCE(AVG(total_dt), 0),
    COALESCE(AVG(items), 0),
    COALESCE(SUM(discount_dt), 0),
    CASE WHEN COALESCE(SUM(total_dt + discount_dt), 0) > 0
         THEN COALESCE(SUM(discount_dt), 0) / SUM(total_dt + discount_dt) * 100
         ELSE 0 END,
    COUNT(*) FILTER (WHERE discount_dt > 0)::bigint,
    CASE WHEN v_visits > 0 THEN COUNT(*)::numeric / v_visits * 100 ELSE NULL END
  FROM baskets;
END;
$$;

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
               WHERE created_at >= v_lo AND created_at < v_hi AND voided_at IS NULL), 0)
  + COALESCE((SELECT SUM(amount_dt) FROM public.locker_payments
               WHERE created_at >= v_lo AND created_at < v_hi), 0)
  - COALESCE((SELECT SUM(amount_dt) FROM public.refunds
               WHERE created_at >= v_lo AND created_at < v_hi), 0)
  INTO v_revenue;

  SELECT COALESCE(SUM(pi.quantity * COALESCE(pr.cost_price, 0)), 0)
    INTO v_cogs
    FROM public.purchase_items pi
    JOIN public.purchases p ON p.id = pi.purchase_id
    JOIN public.products pr ON pr.id = pi.product_id
   WHERE p.created_at >= v_lo AND p.created_at < v_hi AND p.voided_at IS NULL;

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
  v_be       := CASE WHEN v_cm > 0 THEN v_fixed / (v_cm / v_revenue) ELSE NULL END;

  RETURN QUERY SELECT
    v_revenue, v_variable, v_fixed, v_cm, v_cm_pct, v_be,
    CASE WHEN v_be IS NOT NULL AND v_revenue > 0
         THEN (v_revenue - v_be) / v_revenue * 100
         ELSE NULL END;
END;
$$;

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
  + COALESCE((SELECT SUM(total_dt)    FROM public.purchases       WHERE created_at >= v_lo AND voided_at IS NULL), 0)
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
    CASE WHEN v_burn > 0 THEN v_cash / v_burn ELSE NULL END;
END;
$$;

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

  SELECT COALESCE(SUM(s.paid_amount), 0),
         COALESCE(SUM(public.tva_of_ttc(s.paid_amount, sp.tax_rate_pct)), 0)
    INTO v_subs_ttc, v_subs_tva
    FROM public.subscriptions s
    JOIN public.subscription_plans sp ON sp.id = s.plan_id
   WHERE s.created_at >= v_lo AND s.created_at < v_hi;

  WITH scoped AS (
    SELECT pi.purchase_id, pi.quantity, pi.unit_price_dt, pr.tax_rate_pct, p.discount_dt
    FROM public.purchase_items pi
    JOIN public.purchases p ON p.id = pi.purchase_id
    JOIN public.products pr ON pr.id = pi.product_id
    WHERE p.created_at >= v_lo AND p.created_at < v_hi AND p.voided_at IS NULL
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
  v_actor_id  uuid := auth.uid();
  v_session   public.cash_register_sessions;
  v_movements_in  numeric := 0;
  v_movements_out numeric := 0;
  v_sales     numeric := 0;
  v_expected  numeric;
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
   WHERE created_at BETWEEN v_session.opened_at AND now() AND voided_at IS NULL;

  v_expected := v_session.opening_amount_dt + v_movements_in - v_movements_out + v_sales;

  UPDATE public.cash_register_sessions
     SET status             = 'closed',
         closed_by          = v_actor_id,
         closed_at          = now(),
         closing_amount_dt  = p_closing_amount,
         expected_amount_dt = v_expected,
         discrepancy_dt     = p_closing_amount - v_expected,
         notes              = p_notes
   WHERE id = p_session_id
   RETURNING * INTO v_session;

  IF v_session.discrepancy_dt <> 0 THEN
    SELECT id INTO v_discrepancy_category_id
      FROM public.account_categories
     WHERE name = 'Écart de caisse'
     LIMIT 1;

    INSERT INTO public.expenses (account_category_id, description, amount_dt, date, created_by)
    VALUES (
      v_discrepancy_category_id,
      'Écart de caisse — session clôturée le ' || to_char(v_session.closed_at, 'DD/MM/YYYY HH24:MI'),
      -v_session.discrepancy_dt,
      v_session.closed_at::date,
      v_actor_id
    );
  END IF;

  RETURN v_session;
END;
$$;
