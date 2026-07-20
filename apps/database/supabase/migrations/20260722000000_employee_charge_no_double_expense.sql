-- apps/database/supabase/migrations/20260722000000_employee_charge_no_double_expense.sql
--
-- pos_employee_charge booked a second "Charge Employés" expense at cost_price
-- on top of the "Achats stock" expense already booked at restock time — the
-- same stock cost was hitting the finance dashboard twice. The charge still
-- needs to consume stock and be visible in the POS activity log (so it can
-- be distinguished from a normal free sale), it just no longer creates a
-- second expenses row.

CREATE OR REPLACE FUNCTION public.pos_employee_charge(p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id    uuid := auth.uid();
  v_total_dt    numeric := 0;
  v_item        jsonb;
  v_product_id  uuid;
  v_quantity    int;
  v_cost        numeric;
  v_name        text;
  v_is_active   boolean;
  v_stock       int;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Le panier est vide';
  END IF;

  -- Pre-validate without mutating (fail fast, no partial decrements)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity   := (v_item->>'quantity')::int;

    SELECT COALESCE(cost_price, 0), name, is_active, stock_quantity
      INTO v_cost, v_name, v_is_active, v_stock
      FROM public.products WHERE id = v_product_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produit introuvable: %', v_product_id;
    END IF;
    IF NOT v_is_active THEN
      RAISE EXCEPTION 'Produit inactif: %', v_name;
    END IF;
    IF v_stock < v_quantity THEN
      RAISE EXCEPTION 'Stock insuffisant pour "%": % disponible(s), % demandé(s)', v_name, v_stock, v_quantity;
    END IF;

    v_total_dt := v_total_dt + (v_cost * v_quantity);
  END LOOP;

  -- Race-safe decrement + activity log per item (no expenses row: the cost
  -- was already booked as an expense when the stock was restocked).
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity   := (v_item->>'quantity')::int;

    UPDATE public.products
       SET stock_quantity = stock_quantity - v_quantity
     WHERE id = v_product_id AND stock_quantity >= v_quantity
     RETURNING COALESCE(cost_price, 0) INTO v_cost;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock insuffisant pour le produit %, vente concurrente détectée', v_product_id;
    END IF;

    INSERT INTO public.pos_activity_log (action, product_id, actor_id, quantity, amount_dt, details)
    VALUES ('employee_charge', v_product_id, v_actor_id, v_quantity, v_cost * v_quantity, '{}'::jsonb);
  END LOOP;

  RETURN jsonb_build_object('expense_id', null, 'total_dt', v_total_dt);
END;
$$;

GRANT EXECUTE ON FUNCTION public.pos_employee_charge(jsonb) TO authenticated;
