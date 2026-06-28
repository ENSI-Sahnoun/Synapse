-- service_role needs full access to bypass RLS for admin/cron operations
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- authenticated users get DML (RLS policies enforce row-level restrictions)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- anon gets read-only access to public-facing tables
GRANT SELECT ON public.subscription_plans, public.rooms, public.seats TO anon;
