-- Per-notification deep link (e.g. "/employee/reservations?highlight=<id>").
-- Null means "no stored link" — callers fall back to the static per-type
-- route map in lib/notification-links.ts.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS link text;
