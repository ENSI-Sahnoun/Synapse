-- Enable pg_cron extension (Supabase Pro has it available)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily job at 08:00 UTC (09:00 Africa/Tunis)
-- The job POSTs to the Next.js API route with the cron secret
SELECT cron.schedule(
  'synapse-daily-notifications',
  '0 8 * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.base_url') || '/api/notifications/process',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', current_setting('app.cron_secret')
      ),
      body := '{}'::jsonb
    );
  $$
);

-- Operator note: after applying, run once:
--   ALTER DATABASE postgres SET app.base_url = 'https://your-production-domain.com';
--   ALTER DATABASE postgres SET app.cron_secret = 'your_cron_secret_value';
-- These are read at runtime. Never put real values in migration files.
