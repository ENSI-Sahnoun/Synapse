-- Purchase transactions at the POS
CREATE TABLE public.purchases (
  id         uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  student_id uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  sold_by    uuid        NOT NULL REFERENCES public.profiles(id),
  total_dt   numeric     NOT NULL CHECK (total_dt >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX purchases_student_idx ON public.purchases (student_id, created_at DESC);
CREATE INDEX purchases_sold_by_idx ON public.purchases (sold_by, created_at DESC);

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- Employees and admins can create and view purchases
CREATE POLICY "purchases_employee_select"
  ON public.purchases FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('admin', 'employee'));

CREATE POLICY "purchases_employee_insert"
  ON public.purchases FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('admin', 'employee'));

-- Purchase line items
CREATE TABLE public.purchase_items (
  id            uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  purchase_id   uuid        NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id    uuid        NOT NULL REFERENCES public.products(id),
  quantity      int         NOT NULL CHECK (quantity > 0),
  unit_price_dt numeric     NOT NULL CHECK (unit_price_dt >= 0),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX purchase_items_purchase_idx ON public.purchase_items (purchase_id);

ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_items_employee_select"
  ON public.purchase_items FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('admin', 'employee'));

CREATE POLICY "purchase_items_employee_insert"
  ON public.purchase_items FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('admin', 'employee'));
