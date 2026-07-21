-- Subscriptions got voided_at (20260719010000) and refund_subscription
-- (20260720000100) but never received the fixes purchases got in
-- 20260723000000_void_refund_reconciliation.sql:
--   1. Mutual exclusion between pos_void_subscription and refund_subscription
--      (a subscription could be voided after being refunded, or refunded
--      after being voided — either way the student is made whole twice).
--   2. Loyalty points awarded on purchase were never clawed back on void or
--      full refund, so a cancelled/refunded subscription left the student
--      with points for a sale that no longer counts as revenue.
-- Also: pos_edit_subscription (the "changer de formule" action on the admin
-- transaction log) updated plan_id/end_date but never recomputed paid_amount,
-- so the displayed/charged price stayed pinned to the old plan after a
-- formule change.

CREATE OR REPLACE FUNCTION public.pos_edit_subscription(p_subscription_id uuid, p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id     uuid := auth.uid();
  v_old_plan     uuid;
  v_start_date   date;
  v_new_end      date;
  v_price_dt     numeric;
  v_tax_rate_pct numeric;
  v_new_paid     numeric;
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT plan_id, start_date INTO v_old_plan, v_start_date
    FROM public.subscriptions WHERE id = p_subscription_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Abonnement introuvable';
  END IF;

  SELECT duration_days, price_dt, tax_rate_pct INTO v_new_end, v_price_dt, v_tax_rate_pct
    FROM public.subscription_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan introuvable';
  END IF;

  v_new_end := v_start_date + v_new_end;
  v_new_paid := ROUND(v_price_dt * (1 + COALESCE(v_tax_rate_pct, 0) / 100), 3);

  UPDATE public.subscriptions
     SET plan_id = p_plan_id, end_date = v_new_end, paid_amount = v_new_paid
   WHERE id = p_subscription_id;

  INSERT INTO public.pos_activity_log (action, actor_id, subscription_id, details)
  VALUES ('subscription_edit', v_actor_id, p_subscription_id,
    jsonb_build_object('old', jsonb_build_object('plan_id', v_old_plan), 'new', jsonb_build_object('plan_id', p_plan_id, 'paid_amount', v_new_paid)));

  RETURN jsonb_build_object('subscription_id', p_subscription_id, 'plan_id', p_plan_id, 'paid_amount', v_new_paid);
END;
$$;

CREATE OR REPLACE FUNCTION public.pos_void_subscription(p_subscription_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id   uuid := auth.uid();
  v_student_id uuid;
  v_refunded   numeric;
  v_awarded    integer;
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT student_id INTO v_student_id
    FROM public.subscriptions WHERE id = p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Abonnement introuvable';
  END IF;
  IF EXISTS (SELECT 1 FROM public.subscriptions WHERE id = p_subscription_id AND voided_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Abonnement déjà annulé';
  END IF;

  -- Money already handed back through a refund: voiding on top would erase
  -- revenue the student was already repaid out of. Mirrors the purchase-side
  -- rule in 20260723000000.
  v_refunded := public.refunded_total('subscription', p_subscription_id);
  IF v_refunded > 0 THEN
    RAISE EXCEPTION 'Abonnement déjà partiellement ou totalement remboursé, annulation impossible';
  END IF;

  UPDATE public.subscriptions SET voided_at = now(), voided_by = v_actor_id WHERE id = p_subscription_id;

  SELECT COALESCE(SUM(points_delta), 0) INTO v_awarded
    FROM public.loyalty_ledger WHERE ref_id = p_subscription_id AND reason = 'subscription';
  IF v_awarded > 0 AND NOT EXISTS (
    SELECT 1 FROM public.loyalty_ledger
     WHERE ref_id = p_subscription_id AND reason = 'adjustment' AND points_delta < 0
  ) THEN
    INSERT INTO public.loyalty_ledger (student_id, points_delta, reason, ref_id)
    VALUES (v_student_id, -v_awarded, 'adjustment', p_subscription_id);
  END IF;

  INSERT INTO public.pos_activity_log (action, actor_id, subscription_id, details)
  VALUES ('subscription_void', v_actor_id, p_subscription_id, jsonb_build_object('subscription_id', p_subscription_id));

  RETURN jsonb_build_object('subscription_id', p_subscription_id, 'voided', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_subscription(
  p_subscription_id uuid,
  p_amount          numeric,
  p_reason          text,
  p_end_now         boolean DEFAULT true
)
RETURNS public.refunds
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor      uuid := auth.uid();
  v_paid       numeric;
  v_voided     timestamptz;
  v_refunded   numeric;
  v_refund     public.refunds;
  v_student_id uuid;
  v_full       boolean;
  v_awarded    integer;
BEGIN
  IF v_actor IS NULL OR public.current_user_role() NOT IN ('admin', 'employee') THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Montant de remboursement invalide';
  END IF;

  SELECT paid_amount, student_id, voided_at INTO v_paid, v_student_id, v_voided
    FROM public.subscriptions WHERE id = p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Abonnement introuvable';
  END IF;
  -- A voided subscription never happened: nothing left to refund.
  IF v_voided IS NOT NULL THEN
    RAISE EXCEPTION 'Abonnement annulé, remboursement impossible';
  END IF;

  v_refunded := public.refunded_total('subscription', p_subscription_id);
  IF v_refunded + p_amount > v_paid THEN
    RAISE EXCEPTION 'Remboursement (%) supérieur au montant restant (%)',
      p_amount, v_paid - v_refunded;
  END IF;

  v_full := (v_refunded + p_amount) = v_paid;

  -- Ending the membership is what a cancellation-with-refund means. The
  -- subscription row itself is preserved so the original sale stays on the
  -- books and the refund reverses it — rather than the sale vanishing.
  IF p_end_now THEN
    UPDATE public.subscriptions
       SET end_date = LEAST(end_date, (now() AT TIME ZONE 'Africa/Tunis')::date)
     WHERE id = p_subscription_id;
  END IF;

  IF v_full THEN
    SELECT COALESCE(SUM(points_delta), 0) INTO v_awarded
      FROM public.loyalty_ledger WHERE ref_id = p_subscription_id AND reason = 'subscription';
    IF v_awarded > 0 AND NOT EXISTS (
      SELECT 1 FROM public.loyalty_ledger
       WHERE ref_id = p_subscription_id AND reason = 'adjustment' AND points_delta < 0
    ) THEN
      INSERT INTO public.loyalty_ledger (student_id, points_delta, reason, ref_id)
      VALUES (v_student_id, -v_awarded, 'adjustment', p_subscription_id);
    END IF;
  END IF;

  INSERT INTO public.refunds (source, subscription_id, amount_dt, reason, created_by)
  VALUES ('subscription', p_subscription_id, p_amount, p_reason, v_actor)
  RETURNING * INTO v_refund;

  RETURN v_refund;
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
  v_actor      uuid := auth.uid();
  v_total      numeric;
  v_voided     timestamptz;
  v_refunded   numeric;
  v_refund     public.refunds;
  v_item       record;
  v_student_id uuid;
  v_full       boolean;
  v_awarded    integer;
BEGIN
  IF v_actor IS NULL OR public.current_user_role() NOT IN ('admin', 'employee') THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Montant de remboursement invalide';
  END IF;

  SELECT total_dt, voided_at, student_id INTO v_total, v_voided, v_student_id
    FROM public.purchases WHERE id = p_purchase_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vente introuvable';
  END IF;
  IF v_voided IS NOT NULL THEN
    RAISE EXCEPTION 'Achat annulé, remboursement impossible';
  END IF;

  v_refunded := public.refunded_total('purchase', p_purchase_id);
  IF v_refunded + p_amount > v_total THEN
    RAISE EXCEPTION 'Remboursement (%) supérieur au montant restant (%)',
      p_amount, v_total - v_refunded;
  END IF;

  v_full := (v_refunded + p_amount) = v_total;

  IF p_restock AND v_full THEN
    FOR v_item IN
      SELECT product_id, quantity FROM public.purchase_items WHERE purchase_id = p_purchase_id
    LOOP
      UPDATE public.products
         SET stock_quantity = stock_quantity + v_item.quantity
       WHERE id = v_item.product_id;
    END LOOP;
  END IF;

  IF v_full AND v_student_id IS NOT NULL THEN
    SELECT COALESCE(SUM(points_delta), 0) INTO v_awarded
      FROM public.loyalty_ledger WHERE ref_id = p_purchase_id AND reason = 'purchase';
    IF v_awarded > 0 AND NOT EXISTS (
      SELECT 1 FROM public.loyalty_ledger
       WHERE ref_id = p_purchase_id AND reason = 'adjustment' AND points_delta < 0
    ) THEN
      INSERT INTO public.loyalty_ledger (student_id, points_delta, reason, ref_id)
      VALUES (v_student_id, -v_awarded, 'adjustment', p_purchase_id);
    END IF;
  END IF;

  INSERT INTO public.refunds (source, purchase_id, amount_dt, reason, restocked, created_by)
  VALUES ('purchase', p_purchase_id, p_amount, p_reason, p_restock AND v_full, v_actor)
  RETURNING * INTO v_refund;

  RETURN v_refund;
END;
$$;

-- pos_void_purchase already voids-blocks-refund the other way (20260723000000);
-- add the missing loyalty clawback there too, same rule as refund_purchase.
CREATE OR REPLACE FUNCTION public.pos_void_purchase(p_purchase_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id   uuid := auth.uid();
  v_total_dt   numeric;
  v_voided     timestamptz;
  v_refunded   numeric;
  v_student_id uuid;
  v_awarded    integer;
  v_item       record;
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs';
  END IF;

  SELECT total_dt, voided_at, student_id INTO v_total_dt, v_voided, v_student_id
    FROM public.purchases WHERE id = p_purchase_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Achat introuvable';
  END IF;
  IF v_voided IS NOT NULL THEN
    RAISE EXCEPTION 'Achat déjà annulé';
  END IF;

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

  IF v_student_id IS NOT NULL THEN
    SELECT COALESCE(SUM(points_delta), 0) INTO v_awarded
      FROM public.loyalty_ledger WHERE ref_id = p_purchase_id AND reason = 'purchase';
    IF v_awarded > 0 AND NOT EXISTS (
      SELECT 1 FROM public.loyalty_ledger
       WHERE ref_id = p_purchase_id AND reason = 'adjustment' AND points_delta < 0
    ) THEN
      INSERT INTO public.loyalty_ledger (student_id, points_delta, reason, ref_id)
      VALUES (v_student_id, -v_awarded, 'adjustment', p_purchase_id);
    END IF;
  END IF;

  INSERT INTO public.pos_activity_log (action, actor_id, amount_dt, details)
  VALUES ('purchase_void', v_actor_id, v_total_dt,
          jsonb_build_object('purchase_id', p_purchase_id));

  RETURN jsonb_build_object('purchase_id', p_purchase_id, 'voided', true, 'total_dt', v_total_dt);
END;
$$;
