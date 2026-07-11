-- Links a notification back to the announcement that triggered it, so
-- announcement history can compute per-recipient / aggregate read status.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS announcement_id uuid REFERENCES public.announcements(id) ON DELETE CASCADE;
