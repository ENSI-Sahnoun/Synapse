-- Product categories lookup table
CREATE TABLE public.product_categories (
  id         uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name       text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_categories_select"
  ON public.product_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "product_categories_admin"
  ON public.product_categories FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- Seed default categories
INSERT INTO public.product_categories (name) VALUES
  ('Boissons'),
  ('Snacks'),
  ('Papeterie'),
  ('Autre')
ON CONFLICT DO NOTHING;

-- Add image_url to products
ALTER TABLE public.products ADD COLUMN image_url text;

-- Storage bucket for product images (public read)
INSERT INTO storage.buckets (id, name, public)
  VALUES ('product-images', 'product-images', true)
  ON CONFLICT DO NOTHING;

CREATE POLICY "product_images_public_read"
  ON storage.objects FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "product_images_admin_write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.current_user_role() = 'admin');

CREATE POLICY "product_images_admin_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND public.current_user_role() = 'admin');

CREATE POLICY "product_images_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND public.current_user_role() = 'admin');
