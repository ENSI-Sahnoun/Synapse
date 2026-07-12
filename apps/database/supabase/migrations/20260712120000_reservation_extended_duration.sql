-- apps/database/supabase/migrations/20260712120000_reservation_extended_duration.sql
-- Students with a long enough subscription get an extended reservation hold duration.

INSERT INTO public.settings (key, value) VALUES
  ('reservation_hold_minutes_extended',   '60'),
  ('reservation_extended_min_duration_days', '30')
ON CONFLICT (key) DO NOTHING;
