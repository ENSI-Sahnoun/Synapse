-- Targeting was previously transient (used only to scope notifications, then
-- discarded). Persist it so history can show who an announcement was sent to.
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS recipient_id uuid REFERENCES public.profiles(id);
