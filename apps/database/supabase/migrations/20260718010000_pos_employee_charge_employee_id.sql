-- apps/database/supabase/migrations/20260718010000_pos_employee_charge_employee_id.sql
-- Track which employee (or guest, when null) a "Charge Employés" POS expense
-- was for. Only this expense category populates the column.

ALTER TABLE public.expenses
  ADD COLUMN employee_id uuid REFERENCES public.profiles(id);

-- The original signature had a different arity (jsonb only); CREATE OR
-- REPLACE would not touch it, leaving a stale, unvalidated overload
-- reachable by any 1-arg caller. Drop it so only the 2-arg version exists.
DROP FUNCTION IF EXISTS public.pos_employee_charge(jsonb);

CREATE OR REPLACE FUNCTION public.pos_employee_charge(p_items jsonb, p_employee_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id    uuid := auth.uid();
  v_category_id uuid;
  v_expense_id  uuid;
  v_total_dt    numeric := 0;
  v_summary     text := '';
  v_item        jsonb;
  v_product_id  uuid;
  v_quantity    int;
  v_cost        numeric;
  v_name        text;
  v_is_active   boolean;
  v_stock       int;
  v_employee_name text;
  v_employee_role text;
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

  IF p_employee_id IS NOT NULL THEN
    SELECT full_name, role INTO v_employee_name, v_employee_role
      FROM public.profiles WHERE id = p_employee_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Employé introuvable: %', p_employee_id;
    END IF;
    IF v_employee_role NOT IN ('employee', 'admin') THEN
      RAISE EXCEPTION 'Ce profil n''est pas un employé: %', v_employee_name;
    END IF;
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
    v_summary  := v_summary || CASE WHEN v_summary = '' THEN '' ELSE ', ' END
                  || v_quantity || '× ' || v_name;
  END LOOP;

  SELECT id INTO v_category_id
    FROM public.account_categories WHERE name = 'Charge Employés' LIMIT 1;

  INSERT INTO public.expenses (account_category_id, description, amount_dt, date, created_by, employee_id)
  VALUES (
    v_category_id,
    'Charge employés — ' || COALESCE(v_employee_name, 'Invité') || ' — ' || v_summary,
    v_total_dt, now()::date, v_actor_id, p_employee_id
  )
  RETURNING id INTO v_expense_id;

  -- Race-safe decrement + activity log per item
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
    VALUES ('employee_charge', v_product_id, v_actor_id, v_quantity, v_cost * v_quantity,
            jsonb_build_object('expense_id', v_expense_id, 'employee_id', p_employee_id, 'is_guest', p_employee_id IS NULL));
  END LOOP;

  RETURN jsonb_build_object('expense_id', v_expense_id, 'total_dt', v_total_dt);
END;
$$;

GRANT EXECUTE ON FUNCTION public.pos_employee_charge(jsonb, uuid) TO authenticated;
