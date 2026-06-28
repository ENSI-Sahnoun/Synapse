-- Products sold at the coworking space (coffee, snacks, etc.)
CREATE TABLE public.products (
  id             uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name           text        NOT NULL,
  category       text        NOT NULL DEFAULT 'autre',
  price_dt       numeric     NOT NULL CHECK (price_dt >= 0),
  stock_quantity int         NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  is_active      boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX products_category_idx ON public.products (category, name);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view active products (POS needs this for employees)
CREATE POLICY "products_select_authenticated"
  ON public.products FOR SELECT TO authenticated USING (true);

-- Admins manage the product catalogue
CREATE POLICY "products_admin_all"
  ON public.products FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');
