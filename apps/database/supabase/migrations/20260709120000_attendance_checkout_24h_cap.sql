-- Bug: midnight-checkout only ran once/day and closed sessions with
-- checked_out_at = now(), so a single missed run (worker restart, project
-- pause/resume, migration lock) left a session open until the *next* run,
-- baking up to ~48h into the stored duration (seen as a 46h attendance
-- stat). Make the job self-healing: run hourly, only touch sessions that
-- have actually exceeded 24h, and cap checked_out_at at checked_in_at + 24h
-- instead of now() so a late run can't inflate the recorded duration.
select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'midnight-checkout'),
  schedule := '0 * * * *',
  command := $$
    UPDATE public.attendance
    SET checked_out_at = LEAST(now(), checked_in_at + interval '24 hours')
    WHERE checked_out_at IS NULL
      AND checked_in_at < now() - interval '24 hours';

    UPDATE public.seats
    SET status = 'free'
    WHERE status = 'occupied'
      AND id NOT IN (
        SELECT seat_id FROM public.attendance
        WHERE checked_out_at IS NULL AND seat_id IS NOT NULL
      );
  $$
);

COMMENT ON EXTENSION pg_cron IS 'Auto-checkout — hourly sweep closes attendance sessions past 24h, capped at checked_in_at + 24h';

-- Backfill: cap any currently-open session that has already exceeded 24h,
-- e.g. Youssef Sahnoun's stuck-open July 6 session.
UPDATE public.attendance
SET checked_out_at = LEAST(now(), checked_in_at + interval '24 hours')
WHERE checked_out_at IS NULL
  AND checked_in_at < now() - interval '24 hours';

UPDATE public.seats
SET status = 'free'
WHERE status = 'occupied'
  AND id NOT IN (
    SELECT seat_id FROM public.attendance
    WHERE checked_out_at IS NULL AND seat_id IS NOT NULL
  );
