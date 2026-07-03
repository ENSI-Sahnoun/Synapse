-- Prevent two students from holding an active reservation on the same seat.
-- The partial index means only one row with status='active' can exist per seat_id.
CREATE UNIQUE INDEX IF NOT EXISTS reservations_one_active_per_seat
  ON reservations(seat_id)
  WHERE status = 'active';
