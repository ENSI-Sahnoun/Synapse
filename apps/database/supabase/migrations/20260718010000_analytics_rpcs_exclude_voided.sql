-- apps/database/supabase/migrations/20260718010000_analytics_rpcs_exclude_voided.sql
-- Task 5 follow-up: analytics_cogs / analytics_product_margin summed purchase_items
-- for all purchases, including voided ones. Re-create both functions identical to
-- 20260704120000, adding a `p.voided_at IS NULL` filter so voided purchases are
-- excluded from COGS and product margin figures.

CREATE OR REPLACE FUNCTION public.analytics_cogs(p_from date, p_to date)
RETURNS TABLE (cogs numeric, revenue numeric, missing_cost_products int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(pi.quantity * COALESCE(pr.cost_price, 0)), 0) AS cogs,
    COALESCE(SUM(pi.quantity * pi.unit_price_dt), 0) AS revenue,
    COUNT(DISTINCT pr.id) FILTER (WHERE pr.cost_price IS NULL)::int AS missing_cost_products
  FROM public.purchase_items pi
  JOIN public.purchases p ON p.id = pi.purchase_id
  JOIN public.products pr ON pr.id = pi.product_id
  WHERE p.created_at >= p_from AND p.created_at < (p_to + 1)
    AND p.voided_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.analytics_cogs(date, date) TO authenticated;

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
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs';
  END IF;

  RETURN QUERY
  SELECT
    pr.id,
    pr.name,
    SUM(pi.quantity)::bigint AS quantity_sold,
    SUM(pi.quantity * pi.unit_price_dt) AS revenue,
    SUM(pi.quantity * COALESCE(pr.cost_price, 0)) AS cogs,
    SUM(pi.quantity * pi.unit_price_dt) - SUM(pi.quantity * COALESCE(pr.cost_price, 0)) AS margin,
    bool_or(pr.cost_price IS NULL) AS cost_missing
  FROM public.purchase_items pi
  JOIN public.purchases p ON p.id = pi.purchase_id
  JOIN public.products pr ON pr.id = pi.product_id
  WHERE p.created_at >= p_from AND p.created_at < (p_to + 1)
    AND p.voided_at IS NULL
  GROUP BY pr.id, pr.name
  ORDER BY margin DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.analytics_product_margin(date, date) TO authenticated;

NOTIFY pgrst, 'reload schema';
