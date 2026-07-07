-- Bug: resetAttendancePeriod deleted attendance rows without freeing their
-- seats. Any seat marked occupied with no open attendance row backing it is
-- orphaned (stuck occupied forever, invisible on the attendance page).
UPDATE public.seats
SET status = 'free'
WHERE status = 'occupied'
  AND NOT EXISTS (
    SELECT 1 FROM public.attendance
    WHERE attendance.seat_id = seats.id
      AND attendance.checked_out_at IS NULL
  );
