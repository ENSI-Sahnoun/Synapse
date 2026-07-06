-- apps/database/supabase/migrations/20260706130000_realtime_publication_expand.sql
-- Add live-surface tables to the supabase_realtime publication with
-- REPLICA IDENTITY FULL so useLiveRows / useLiveRefetch receive their changes.
-- Already published (not repeated here): reservations, seats, tables, notifications.

DO $$
DECLARE
  t text;
  tbls text[] := ARRAY[
    'seat_swap_requests',
    'attendance',
    'subscriptions',
    'subscription_plans',
    'purchases',
    'purchase_items',
    'expenses',
    'announcements',
    'shifts',
    'profiles',
    'settings',
    'rooms',
    'products',
    'product_categories',
    'loyalty_redemption_requests',
    'loyalty_ledger',
    'loyalty_rules'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    -- REPLICA IDENTITY FULL: UPDATE/DELETE payloads include old row values.
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    -- Add to publication only if not already a member.
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
