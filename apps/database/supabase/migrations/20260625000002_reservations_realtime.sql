-- Enable Realtime for reservations table so future subscriptions work
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
