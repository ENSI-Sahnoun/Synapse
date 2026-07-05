-- ============================================================
-- ENABLE pg_cron (requires Supabase project with pg_cron enabled
-- in Database > Extensions in the dashboard for hosted projects)
-- ============================================================
-- Guard the create: Supabase's local Postgres image ships pg_cron pre-installed,
-- and re-issuing CREATE EXTENSION triggers an update path that fails with
-- 2BP01 (dependent privileges) on `supabase start`/`db reset`. Skip entirely
-- when already present. No behavior change for prod.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION pg_cron WITH SCHEMA extensions;
  END IF;
END $$;

-- Grant pg_cron usage to postgres role (Supabase default)
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- ============================================================
-- EXPIRY FUNCTION
-- Called every 5 minutes by pg_cron.
-- 1. Finds all reservations that are 'active' but past expires_at
-- 2. Sets them to 'expired'
-- 3. Sets the corresponding seat back to 'free'
--    (only if that seat still has status 'reserved' — guards
--     against a fulfilled reservation where seat is 'occupied')
-- Supabase Realtime broadcasts the seats UPDATE automatically.
-- ============================================================
CREATE OR REPLACE FUNCTION public.expire_stale_reservations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_seat_ids uuid[];
BEGIN
  -- 1. Collect seat IDs of stale active reservations
  SELECT ARRAY_AGG(seat_id)
  INTO expired_seat_ids
  FROM public.reservations
  WHERE status = 'active'
    AND expires_at < now();

  -- 2. Expire the reservations
  UPDATE public.reservations
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at < now();

  -- 3. Free the seats (only those still marked 'reserved')
  IF expired_seat_ids IS NOT NULL THEN
    UPDATE public.seats
    SET status = 'free'
    WHERE id = ANY(expired_seat_ids)
      AND status = 'reserved';
  END IF;
END;
$$;

-- ============================================================
-- SCHEDULE: run every 5 minutes
-- Job name is idempotent — unschedule first to allow re-runs
-- of this migration in CI / local reset.
-- Wrap in DO block to handle cases where pg_cron may not be available.
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('expire_stale_reservations')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire_stale_reservations');

    PERFORM cron.schedule(
      'expire_stale_reservations',
      '*/5 * * * *',
      $cron$
        SELECT public.expire_stale_reservations();
      $cron$
    );
  END IF;
END;
$$;
