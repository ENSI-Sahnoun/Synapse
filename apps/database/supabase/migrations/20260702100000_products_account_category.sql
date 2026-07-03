-- Products need an account_category_id for P&L reporting (getPnl/accounting export
-- group product sales by income category). Defaults every existing and future
-- product to the "Ventes en magasin" income category so revenue is always accounted
-- for even though the product form doesn't expose this field yet.
ALTER TABLE public.products
  ADD COLUMN account_category_id uuid REFERENCES public.account_categories(id);

UPDATE public.products
SET account_category_id = (
  SELECT id FROM public.account_categories WHERE name = 'Ventes en magasin' LIMIT 1
)
WHERE account_category_id IS NULL;

-- Postgres forbids a bare subquery in DEFAULT — wrap it in a STABLE function instead.
CREATE FUNCTION public.default_sales_account_category_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT id FROM public.account_categories WHERE name = 'Ventes en magasin' LIMIT 1
$$;

ALTER TABLE public.products
  ALTER COLUMN account_category_id SET DEFAULT public.default_sales_account_category_id(),
  ALTER COLUMN account_category_id SET NOT NULL;
