-- apps/database/supabase/migrations/20260719020000_pos_corrections.sql
-- Admin correction tools for the Boutique transaction log: fix a misclicked
-- quantity/item, or void a purchase/subscription/charge entirely. All
-- mutations are atomic (stock + total + log in one transaction) and logged
-- to pos_activity_log for audit, mirroring pos_checkout/pos_employee_charge.

ALTER TABLE public.pos_activity_log DROP CONSTRAINT pos_activity_log_action_check;
ALTER TABLE public.pos_activity_log ADD CONSTRAINT pos_activity_log_action_check
  CHECK (action IN (
    'sale', 'restock', 'product_create', 'product_update', 'employee_charge',
    'purchase_edit', 'purchase_void',
    'subscription_edit', 'subscription_void',
    'charge_void'
  ));

ALTER TABLE public.pos_activity_log
  ADD COLUMN subscription_id uuid REFERENCES public.subscriptions(id);

-- Edit a purchase line item's quantity and/or which product it is. The line's
-- price is re-snapshotted from the (possibly new) product's current price_dt
-- — this is "fixing what was actually sold," not replaying history.
CREATE OR REPLACE FUNCTION public.pos_edit_purchase_item(
  p_item_id uuid, p_quantity int, p_product_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id     uuid := auth.uid();
  v_purchase_id  uuid;
  v_old_qty      int;
  v_old_product  uuid;
  v_old_price    numeric;
  v_new_price    numeric;
  v_new_stock    int;
  v_delta_total  numeric;
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantité invalide';
  END IF;

  SELECT purchase_id, quantity, product_id, unit_price_dt
    INTO v_purchase_id, v_old_qty, v_old_product, v_old_price
    FROM public.purchase_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ligne introuvable';
  END IF;

  SELECT price_dt, stock_quantity INTO v_new_price, v_new_stock
    FROM public.products WHERE id = p_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produit introuvable';
  END IF;

  -- restore old product's stock, decrement new product's stock
  UPDATE public.products SET stock_quantity = stock_quantity + v_old_qty WHERE id = v_old_product;
  UPDATE public.products SET stock_quantity = stock_quantity - p_quantity WHERE id = p_product_id
    AND stock_quantity >= p_quantity;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock insuffisant pour le produit corrigé';
  END IF;

  UPDATE public.purchase_items
     SET quantity = p_quantity, product_id = p_product_id, unit_price_dt = v_new_price
   WHERE id = p_item_id;

  v_delta_total := (v_new_price * p_quantity) - (v_old_price * v_old_qty);
  UPDATE public.purchases SET total_dt = total_dt + v_delta_total WHERE id = v_purchase_id;

  INSERT INTO public.pos_activity_log (action, product_id, actor_id, quantity, amount_dt, details)
  VALUES ('purchase_edit', p_product_id, v_actor_id, p_quantity, v_new_price * p_quantity,
    jsonb_build_object(
      'purchase_id', v_purchase_id, 'item_id', p_item_id,
      'old', jsonb_build_object('product_id', v_old_product, 'quantity', v_old_qty, 'unit_price_dt', v_old_price),
      'new', jsonb_build_object('product_id', p_product_id, 'quantity', p_quantity, 'unit_price_dt', v_new_price)
    ));

  RETURN jsonb_build_object('purchase_id', v_purchase_id, 'new_total_dt', v_delta_total);
END;
$$;

-- Void an entire purchase: restore stock for every line item, mark voided.
CREATE OR REPLACE FUNCTION public.pos_void_purchase(p_purchase_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_item     record;
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF EXISTS (SELECT 1 FROM public.purchases WHERE id = p_purchase_id AND voided_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Achat déjà annulé';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.purchases WHERE id = p_purchase_id) THEN
    RAISE EXCEPTION 'Achat introuvable';
  END IF;

  FOR v_item IN SELECT product_id, quantity FROM public.purchase_items WHERE purchase_id = p_purchase_id
  LOOP
    UPDATE public.products SET stock_quantity = stock_quantity + v_item.quantity WHERE id = v_item.product_id;
  END LOOP;

  UPDATE public.purchases SET voided_at = now(), voided_by = v_actor_id WHERE id = p_purchase_id;

  INSERT INTO public.pos_activity_log (action, actor_id, details)
  VALUES ('purchase_void', v_actor_id, jsonb_build_object('purchase_id', p_purchase_id));

  RETURN jsonb_build_object('purchase_id', p_purchase_id, 'voided', true);
END;
$$;

-- Edit which plan a subscription is for. No stock/inventory involved.
CREATE OR REPLACE FUNCTION public.pos_edit_subscription(p_subscription_id uuid, p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id   uuid := auth.uid();
  v_old_plan   uuid;
  v_start_date date;
  v_new_end    date;
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT plan_id, start_date INTO v_old_plan, v_start_date
    FROM public.subscriptions WHERE id = p_subscription_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Abonnement introuvable';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE id = p_plan_id) THEN
    RAISE EXCEPTION 'Plan introuvable';
  END IF;

  SELECT v_start_date + duration_days INTO v_new_end
    FROM public.subscription_plans WHERE id = p_plan_id;

  UPDATE public.subscriptions SET plan_id = p_plan_id, end_date = v_new_end WHERE id = p_subscription_id;

  INSERT INTO public.pos_activity_log (action, actor_id, subscription_id, details)
  VALUES ('subscription_edit', v_actor_id, p_subscription_id,
    jsonb_build_object('old', jsonb_build_object('plan_id', v_old_plan), 'new', jsonb_build_object('plan_id', p_plan_id)));

  RETURN jsonb_build_object('subscription_id', p_subscription_id, 'plan_id', p_plan_id);
END;
$$;

-- Void a subscription (soft delete).
CREATE OR REPLACE FUNCTION public.pos_void_subscription(p_subscription_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE id = p_subscription_id) THEN
    RAISE EXCEPTION 'Abonnement introuvable';
  END IF;
  IF EXISTS (SELECT 1 FROM public.subscriptions WHERE id = p_subscription_id AND voided_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Abonnement déjà annulé';
  END IF;

  UPDATE public.subscriptions SET voided_at = now(), voided_by = v_actor_id WHERE id = p_subscription_id;

  INSERT INTO public.pos_activity_log (action, actor_id, subscription_id, details)
  VALUES ('subscription_void', v_actor_id, p_subscription_id, jsonb_build_object('subscription_id', p_subscription_id));

  RETURN jsonb_build_object('subscription_id', p_subscription_id, 'voided', true);
END;
$$;

-- Void an employee charge: restore stock, delete the linked expense, log a
-- follow-up append-only row referencing the original (pos_activity_log stays
-- insert-only; we never mutate the original 'employee_charge' row).
CREATE OR REPLACE FUNCTION public.pos_void_charge(p_activity_log_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id    uuid := auth.uid();
  v_product_id  uuid;
  v_quantity    int;
  v_expense_id  uuid;
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT product_id, quantity, (details->>'expense_id')::uuid
    INTO v_product_id, v_quantity, v_expense_id
    FROM public.pos_activity_log
   WHERE id = p_activity_log_id AND action = 'employee_charge';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Charge introuvable';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.pos_activity_log
     WHERE action = 'charge_void' AND (details->>'original_id')::uuid = p_activity_log_id
  ) THEN
    RAISE EXCEPTION 'Charge déjà annulée';
  END IF;

  UPDATE public.products SET stock_quantity = stock_quantity + v_quantity WHERE id = v_product_id;
  DELETE FROM public.expenses WHERE id = v_expense_id;

  INSERT INTO public.pos_activity_log (action, product_id, actor_id, quantity, details)
  VALUES ('charge_void', v_product_id, v_actor_id, v_quantity, jsonb_build_object('original_id', p_activity_log_id));

  RETURN jsonb_build_object('original_id', p_activity_log_id, 'voided', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.pos_edit_purchase_item(uuid, int, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_void_purchase(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_edit_subscription(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_void_subscription(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_void_charge(uuid) TO authenticated;
