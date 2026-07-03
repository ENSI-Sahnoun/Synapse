-- apps/database/supabase/migrations/20260703060002_pos_restock_function.sql

CREATE OR REPLACE FUNCTION public.pos_restock(
  p_product_id uuid,
  p_quantity int,
  p_cost_price numeric,
  p_tax_rate_pct numeric DEFAULT 19
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id   uuid := auth.uid();
  v_name       text;
  v_new_stock  int;
  v_total      numeric;
  v_category_id uuid;
  v_expense_id uuid;
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Accès refusé: droits administrateur requis';
  END IF;
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantité invalide: %', p_quantity;
  END IF;
  IF p_cost_price < 0 THEN
    RAISE EXCEPTION 'Coût invalide: %', p_cost_price;
  END IF;

  UPDATE public.products
     SET stock_quantity = stock_quantity + p_quantity,
         cost_price = p_cost_price
   WHERE id = p_product_id
   RETURNING name, stock_quantity INTO v_name, v_new_stock;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produit introuvable: %', p_product_id;
  END IF;

  v_total := p_quantity * p_cost_price * (1 + p_tax_rate_pct / 100);

  SELECT id INTO v_category_id FROM public.account_categories WHERE name = 'Achats stock' LIMIT 1;

  INSERT INTO public.expenses (account_category_id, description, amount_dt, created_by)
  VALUES (v_category_id, format('Réappro: %s x%s', v_name, p_quantity), v_total, v_actor_id)
  RETURNING id INTO v_expense_id;

  INSERT INTO public.pos_activity_log (action, product_id, actor_id, quantity, amount_dt, details)
  VALUES ('restock', p_product_id, v_actor_id, p_quantity, v_total,
          jsonb_build_object('cost_price', p_cost_price, 'tax_rate_pct', p_tax_rate_pct, 'expense_id', v_expense_id));

  RETURN jsonb_build_object('new_stock_quantity', v_new_stock, 'expense_id', v_expense_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.pos_restock(uuid, int, numeric, numeric) TO authenticated;
