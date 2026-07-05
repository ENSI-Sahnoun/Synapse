-- Guard the create: Supabase's local Postgres image ships pg_cron pre-installed,
-- and re-issuing CREATE EXTENSION triggers an update path that fails with
-- 2BP01 (dependent privileges) on `supabase start`/`db reset`. Skip entirely
-- when already present. No behavior change for prod.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION pg_cron;
  END IF;
END $$;

SELECT cron.schedule(
  'midnight-checkout',
  '0 0 * * *',
  $$
    UPDATE public.attendance
    SET checked_out_at = now()
    WHERE checked_out_at IS NULL;
  $$
);

COMMENT ON EXTENSION pg_cron IS 'Auto-checkout at midnight — closes all open attendance sessions';
