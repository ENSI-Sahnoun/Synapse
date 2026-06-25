-- Called when a priority student inserts before non-priority entries.
-- Increments queue_position by 1 for all active reservations
-- with queue_position >= from_position, making a gap for the priority insert.
CREATE OR REPLACE FUNCTION public.shift_queue_positions_down(from_position int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.reservations
  SET queue_position = queue_position + 1
  WHERE status = 'active'
    AND queue_position >= from_position;
END;
$$;

GRANT EXECUTE ON FUNCTION public.shift_queue_positions_down(int) TO authenticated;
