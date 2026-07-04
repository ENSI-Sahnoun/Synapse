-- Fix: 9 tables were created without the standard Supabase role grants,
-- causing "permission denied for table ..." (42501) for every client,
-- including service_role. RLS is enabled on all of them, so these grants
-- restore the platform default while policies keep gating rows.
-- Symptom fixed: /admin/products crashed with "Erreur de chargement des produits".

grant select, insert, update, delete on
  public.announcements,
  public.pos_activity_log,
  public.product_categories,
  public.products,
  public.purchase_items,
  public.purchases,
  public.push_subscriptions,
  public.seat_swap_requests,
  public.shifts
to authenticated, service_role;

-- match platform default for future tables created via the SQL editor
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
