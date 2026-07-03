-- apps/database/supabase/migrations/20260703060000_pos_overhaul_schema.sql

ALTER TABLE public.products
  ADD COLUMN cost_price numeric CHECK (cost_price >= 0),
  ADD COLUMN supplier   text,
  ADD COLUMN barcode    text UNIQUE;

CREATE TABLE public.pos_activity_log (
  id         uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  action     text        NOT NULL CHECK (action IN ('sale', 'restock', 'product_create', 'product_update')),
  product_id uuid        REFERENCES public.products(id),
  actor_id   uuid        NOT NULL REFERENCES public.profiles(id),
  quantity   int,
  amount_dt  numeric,
  details    jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pos_activity_log_created_at_idx ON public.pos_activity_log (created_at DESC);
CREATE INDEX pos_activity_log_product_id_idx ON public.pos_activity_log (product_id);

ALTER TABLE public.pos_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pos_activity_log_admin_select" ON public.pos_activity_log
  FOR SELECT TO authenticated
  USING (public.current_user_role() = 'admin');

CREATE POLICY "pos_activity_log_own_select" ON public.pos_activity_log
  FOR SELECT TO authenticated
  USING (actor_id = auth.uid());

-- No direct INSERT/UPDATE/DELETE policy: only SECURITY DEFINER functions
-- and server actions using the admin client write to this table.

INSERT INTO public.account_categories (type, name, description) VALUES
  ('expense', 'Achats stock', 'Réapprovisionnement de produits POS')
ON CONFLICT DO NOTHING;
