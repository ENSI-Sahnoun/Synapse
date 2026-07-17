-- Daily reset: replaces the broken "midnight-checkout" job (which drifted
-- into an hourly 24h-stale-sweep — see 20260709120000_attendance_checkout_24h_cap.sql
-- — and never handled UTC-vs-local time, caisses, reservations, or notifications).
--
-- This job runs every 5 minutes and checks whether local time (Africa/Tunis,
-- fixed UTC+1, no DST since 2005) has passed the configured reset time and
-- today's reset hasn't already run. Checking on a timer (instead of scheduling
-- cron at a fixed UTC time) means changing the `daily_reset_time` setting takes
-- effect immediately with no need to re-schedule the cron job, and a missed
-- tick (worker restart, project pause) self-heals on the next tick instead of
-- silently skipping the day — same self-healing rationale as the 24h-cap fix.
--
-- Actions performed once per day at the configured time:
--   1. Check out every open attendance session, free their seats
--   2. Auto-close every open cash register session
--   3. Cancel (expire) every active reservation, free reserved seats
--   4. Mark every notification as read

INSERT INTO public.settings (key, value) VALUES
  ('daily_reset_time', '00:00')
ON CONFLICT (key) DO NOTHING;

-- Sentinel: empty string never matches a real date, so the first tick after
-- deploy always fires once local time has passed daily_reset_time today.
INSERT INTO public.settings (key, value) VALUES
  ('daily_reset_last_run', '')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.run_daily_reset()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reset_time   time;
  v_last_run     text;
  v_local_now    timestamptz := timezone('Africa/Tunis', now());
  v_local_date   text := to_char(v_local_now, 'YYYY-MM-DD');
  v_local_time   time := v_local_now::time;
  expired_seat_ids uuid[];
BEGIN
  SELECT value::time INTO v_reset_time
    FROM public.settings WHERE key = 'daily_reset_time';
  IF v_reset_time IS NULL THEN
    v_reset_time := '00:00'::time;
  END IF;

  SELECT value INTO v_last_run
    FROM public.settings WHERE key = 'daily_reset_last_run';

  -- Already ran today, or local time hasn't reached the configured reset time yet
  IF v_last_run = v_local_date OR v_local_time < v_reset_time THEN
    RETURN;
  END IF;

  -- 1. Check out all open attendance sessions, free their seats
  UPDATE public.attendance
  SET checked_out_at = now()
  WHERE checked_out_at IS NULL;

  UPDATE public.seats
  SET status = 'free'
  WHERE status = 'occupied';

  -- 2. Auto-close every open cash register session
  UPDATE public.cash_register_sessions s
  SET status             = 'closed',
      closed_at          = now(),
      expected_amount_dt = s.opening_amount_dt
        + COALESCE((SELECT SUM(amount_dt) FROM public.cash_movements
                     WHERE session_id = s.id AND type = 'in'), 0)
        - COALESCE((SELECT SUM(amount_dt) FROM public.cash_movements
                     WHERE session_id = s.id AND type = 'out'), 0)
        + COALESCE((SELECT SUM(total_dt) FROM public.purchases
                     WHERE created_at BETWEEN s.opened_at AND now()), 0),
      closing_amount_dt  = s.opening_amount_dt
        + COALESCE((SELECT SUM(amount_dt) FROM public.cash_movements
                     WHERE session_id = s.id AND type = 'in'), 0)
        - COALESCE((SELECT SUM(amount_dt) FROM public.cash_movements
                     WHERE session_id = s.id AND type = 'out'), 0)
        + COALESCE((SELECT SUM(total_dt) FROM public.purchases
                     WHERE created_at BETWEEN s.opened_at AND now()), 0),
      discrepancy_dt     = 0,
      notes              = 'Clôture automatique (réinitialisation quotidienne)'
  WHERE s.status = 'open';

  -- 3. Cancel (expire) all active reservations, free reserved seats
  SELECT ARRAY_AGG(seat_id) INTO expired_seat_ids
    FROM public.reservations WHERE status = 'active';

  UPDATE public.reservations
  SET status = 'expired'
  WHERE status = 'active';

  IF expired_seat_ids IS NOT NULL THEN
    UPDATE public.seats
    SET status = 'free'
    WHERE id = ANY(expired_seat_ids) AND status = 'reserved';
  END IF;

  -- 4. Mark every notification as read
  UPDATE public.notifications
  SET is_read = true
  WHERE is_read = false;

  UPDATE public.settings
  SET value = v_local_date
  WHERE key = 'daily_reset_last_run';
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_daily_reset() TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('daily-reset')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-reset');

    PERFORM cron.schedule(
      'daily-reset',
      '*/5 * * * *',
      $cron$ SELECT public.run_daily_reset(); $cron$
    );
  END IF;
END;
$$;

COMMENT ON EXTENSION pg_cron IS 'Daily reset (checkout/caisses/reservations/notifications) — configurable via settings.daily_reset_time';
