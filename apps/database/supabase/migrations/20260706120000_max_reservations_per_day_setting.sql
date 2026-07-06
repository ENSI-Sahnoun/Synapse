-- apps/database/supabase/migrations/20260706120000_max_reservations_per_day_setting.sql

-- Daily reservation cap per student. Read by the createReservation server action
-- with a fallback of '3', so this seed is for admin visibility/tuning.
INSERT INTO public.settings (key, value) VALUES
  ('max_reservations_per_day', '3')
ON CONFLICT (key) DO NOTHING;
