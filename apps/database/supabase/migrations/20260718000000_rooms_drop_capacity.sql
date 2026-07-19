-- Capacity was a manually-entered number that drifted from the actual seat
-- count in the room editor. Capacity is now always derived by counting the
-- room's `seats` rows at read time, so the stored column is dead weight.
ALTER TABLE public.rooms DROP COLUMN capacity;
