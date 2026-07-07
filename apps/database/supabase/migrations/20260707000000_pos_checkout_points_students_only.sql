-- "Pour moi" POS purchases let staff tie a sale to their own profile (student_id).
-- pos_checkout previously credited loyalty points to whatever student_id was
-- passed, so a staff self-purchase silently created a loyalty_ledger row for
-- a non-student profile. Points earned should only ever require role='student'.

CREATE OR REPLACE FUNCTION public.pos_checkout(p_student_id uuid, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id     uuid := auth.uid();
  v_purchase_id  uuid;
  v_total_dt     numeric := 0;
  v_points       int := 0;
  v_item         jsonb;
  v_product_id   uuid;
  v_quantity     int;
  v_price        numeric;
  v_name         text;
  v_is_active    boolean;
  v_new_stock    int;
  v_is_student   boolean;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Le panier est vide';
  END IF;

  -- Pre-validate existence/active/stock without mutating (fail fast, no partial decrements)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity   := (v_item->>'quantity')::int;

    SELECT price_dt, name, is_active, stock_quantity
      INTO v_price, v_name, v_is_active, v_new_stock
      FROM public.products WHERE id = v_product_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produit introuvable: %', v_product_id;
    END IF;
    IF NOT v_is_active THEN
      RAISE EXCEPTION 'Produit inactif: %', v_name;
    END IF;
    IF v_new_stock < v_quantity THEN
      RAISE EXCEPTION 'Stock insuffisant pour "%": % disponible(s), % demandé(s)', v_name, v_new_stock, v_quantity;
    END IF;

    v_total_dt := v_total_dt + (v_price * v_quantity);
  END LOOP;

  INSERT INTO public.purchases (student_id, sold_by, total_dt)
  VALUES (p_student_id, v_actor_id, v_total_dt)
  RETURNING id INTO v_purchase_id;

  -- Atomic, race-safe decrement + line items + activity log per item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity   := (v_item->>'quantity')::int;

    UPDATE public.products
       SET stock_quantity = stock_quantity - v_quantity
     WHERE id = v_product_id AND stock_quantity >= v_quantity
     RETURNING price_dt, name INTO v_price, v_name;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock insuffisant pour le produit %, vente concurrente détectée', v_product_id;
    END IF;

    INSERT INTO public.purchase_items (purchase_id, product_id, quantity, unit_price_dt)
    VALUES (v_purchase_id, v_product_id, v_quantity, v_price);

    INSERT INTO public.pos_activity_log (action, product_id, actor_id, quantity, amount_dt, details)
    VALUES ('sale', v_product_id, v_actor_id, v_quantity, v_price * v_quantity, jsonb_build_object('purchase_id', v_purchase_id));
  END LOOP;

  IF p_student_id IS NOT NULL THEN
    SELECT (role = 'student') INTO v_is_student FROM public.profiles WHERE id = p_student_id;

    IF v_is_student THEN
      v_points := floor(v_total_dt)::int;
      IF v_points > 0 THEN
        INSERT INTO public.loyalty_ledger (student_id, points_delta, reason, ref_id)
        VALUES (p_student_id, v_points, 'purchase', v_purchase_id);
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('purchase_id', v_purchase_id, 'total_dt', v_total_dt, 'points_earned', v_points);
END;
$$;
