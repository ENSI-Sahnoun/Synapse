-- attendance.seat_id was a bare uuid with no FK, so deleting a seat in the
-- seat-map editor left open attendance rows pointing at a seat that no longer
-- exists. A dangling attendance.seat_id then propagates into
-- seat_swap_requests.from_seat_id on insert and fails with
-- "violates foreign key constraint seat_swap_requests_from_seat_id_fkey".

-- 1. Clean existing orphans: any attendance whose seat is gone moves to "Divers".
UPDATE public.attendance a
  SET seat_id = NULL
  WHERE a.seat_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.seats s WHERE s.id = a.seat_id);

-- 2. Enforce it going forward: deleting a seat frees its occupant automatically.
ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_seat_id_fkey
  FOREIGN KEY (seat_id) REFERENCES public.seats(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
