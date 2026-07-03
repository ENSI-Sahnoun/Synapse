-- Make live updates reliable without manual refresh.
--
-- seats/tables/reservations were already added to the supabase_realtime
-- publication, but with the default REPLICA IDENTITY (primary key only) the
-- old-row image on UPDATE/DELETE is empty, so postgres_changes filters and
-- delete events are dropped — clients only saw changes after a full reload.
-- FULL replica identity ships the whole row so filtered subscriptions fire.
ALTER TABLE public.seats REPLICA IDENTITY FULL;
ALTER TABLE public.tables REPLICA IDENTITY FULL;
ALTER TABLE public.reservations REPLICA IDENTITY FULL;

-- notifications were never in the publication → the bell never updated live.
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
