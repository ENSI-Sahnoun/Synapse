-- Phase 4C: add is_priority flag to reservations for exam mode queue ordering
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS is_priority boolean NOT NULL DEFAULT false;
