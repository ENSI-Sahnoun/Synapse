CREATE EXTENSION IF NOT EXISTS pg_cron;

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
