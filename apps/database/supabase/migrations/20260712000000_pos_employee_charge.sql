-- apps/database/supabase/migrations/20260712000000_pos_employee_charge.sql
-- "Charges" POS section (admin only): items given free to employees generate
-- zero revenue — no purchases row — but still consume stock, so their value
-- is booked as a dépense in a dedicated "Charge Employés" category.
-- Booked at cost_price (not sale price): the real economic loss is what the
-- stock cost, not the revenue forgone. NULL cost_price books 0, matching the
-- COALESCE(cost_price, 0) convention in the analytics COGS RPCs.

-- Dedicated expense category.
INSERT INTO public.account_categories (type, name, description)
SELECT 'expense', 'Charge Employés',
       'Articles du POS offerts aux employés (0 revenu) — généré automatiquement depuis la section Charges du POS'
WHERE NOT EXISTS (
  SELECT 1 FROM public.account_categories WHERE name = 'Charge Employés'
);

-- Allow the new action in the POS activity log.
ALTER TABLE public.pos_activity_log DROP CONSTRAINT pos_activity_log_action_check;
ALTER TABLE public.pos_activity_log ADD CONSTRAINT pos_activity_log_action_check
  CHECK (action IN ('sale', 'restock', 'product_create', 'product_update', 'employee_charge'));

-- Atomic: validate stock, decrement, log, book one expense. Admin only.
-- SECURITY DEFINER mirrors pos_checkout; the expenses RLS blocks non-admins
-- anyway, but the role check makes the intent explicit.
CREATE OR REPLACE FUNCTION public.pos_employee_charge(p_items jsonb)
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
    v_summary  := v_summary || CASE WHEN v_summary = '' THEN '' ELSE ', ' END
                  || v_quantity || '× ' || v_name;
  END LOOP;

  SELECT id INTO v_category_id
    FROM public.account_categories WHERE name = 'Charge Employés' LIMIT 1;

  INSERT INTO public.expenses (account_category_id, description, amount_dt, date, created_by)
  VALUES (v_category_id, 'Charge employés — ' || v_summary, v_total_dt, now()::date, v_actor_id)
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
            jsonb_build_object('expense_id', v_expense_id));
  END LOOP;

  RETURN jsonb_build_object('expense_id', v_expense_id, 'total_dt', v_total_dt);
END;
$$;

GRANT EXECUTE ON FUNCTION public.pos_employee_charge(jsonb) TO authenticated;
