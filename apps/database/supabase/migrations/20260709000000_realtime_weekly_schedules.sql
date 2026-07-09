-- apps/database/supabase/migrations/20260709000000_realtime_weekly_schedules.sql
-- weekly_schedules (added in 20260707010000) was missed from the realtime
-- publication expansion. Add it so the employee "Mes horaires" page can go live.

ALTER TABLE public.weekly_schedules REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'weekly_schedules'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.weekly_schedules;
  END IF;
END $$;
