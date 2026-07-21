-- apps/database/supabase/migrations/20260721000000_purchase_void.sql
--
-- Admin correction tool for the Boutique transaction log: cancel a purchase
-- that was rung up by mistake.
--
-- Void is a SOFT delete. A hard DELETE would cascade purchase_items away and
-- leave no trace that the sale ever happened, which is exactly what an owner
-- reviewing the till at close of day needs to see. The voided row stays in
-- the transaction log (struck through) and drops out of every revenue,
-- margin, COGS and cash-reconciliation figure.
--
-- Stock restoration, the soft delete and the audit row happen inside one
-- SECURITY DEFINER function so a failure halfway cannot leave stock and
-- revenue disagreeing — same pattern as pos_checkout / pos_employee_charge.

-- voided_at / voided_by / purchases_voided_at_idx already added by
-- 20260719010000_purchases_subscriptions_voided.sql.

-- Allow the new action in the POS activity log.
ALTER TABLE public.pos_activity_log DROP CONSTRAINT pos_activity_log_action_check;
ALTER TABLE public.pos_activity_log ADD CONSTRAINT pos_activity_log_action_check
  CHECK (action IN (
    'sale', 'restock', 'product_create', 'product_update',
    'employee_charge', 'purchase_void'
  ));

-- Void a purchase: restore stock for every line, mark it voided, log it.
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
  v_item     record;
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs';
  END IF;

  -- FOR UPDATE serialises concurrent voids of the same purchase, so two
  -- admins clicking at once cannot each restore stock.
  SELECT total_dt, voided_at INTO v_total_dt, v_voided
    FROM public.purchases WHERE id = p_purchase_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Achat introuvable';
  END IF;
  IF v_voided IS NOT NULL THEN
    RAISE EXCEPTION 'Achat déjà annulé';
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

GRANT EXECUTE ON FUNCTION public.pos_void_purchase(uuid) TO authenticated;
