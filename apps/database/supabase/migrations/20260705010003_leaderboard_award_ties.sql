-- Fix tie-collision bug in award_monthly_leaderboard(): rank() OVER (...) assigns
-- the SAME rnk to tied students (e.g. two students tied at #1 both get rnk=1).
-- The awards table has UNIQUE(month,category,rank), so the second tied winner's
-- INSERT hits ON CONFLICT (month,category,rank) DO NOTHING and is silently
-- dropped -- no award row, no loyalty_ledger credit -- even though the board
-- displays them at #1. Switch AWARD ranking to row_number() OVER (... ORDER BY
-- value DESC, student_id) so each of the top-3 slots maps to exactly one
-- distinct student, with a deterministic (student_id) tie-break.
--
-- Note: get_leaderboard() (display) intentionally still uses rank() so tied
-- students both show as #1 on the board -- only the AWARD assignment changes.
CREATE OR REPLACE FUNCTION public.award_monthly_leaderboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_month date := (date_trunc('month', now()) - interval '1 month')::date;
BEGIN
  WITH ranked AS (
    SELECT m.category, m.student_id,
           row_number() OVER (PARTITION BY m.category ORDER BY m.value DESC, m.student_id) AS rnk
    FROM public._leaderboard_metrics(v_month::date) m
    WHERE m.value > 0
  ),
  winners AS (
    SELECT r.category, r.student_id, r.rnk::int AS rnk,
           CASE r.rnk WHEN 1 THEN c.points_1
                      WHEN 2 THEN c.points_2
                      WHEN 3 THEN c.points_3 END AS points
    FROM ranked r
    JOIN public.leaderboard_config c ON c.category = r.category
    WHERE r.rnk <= 3
  ),
  inserted AS (
    INSERT INTO public.leaderboard_awards (month, category, rank, student_id, points)
    SELECT v_month, w.category, w.rnk, w.student_id, w.points
    FROM winners w
    WHERE w.points > 0
    ON CONFLICT (month, category, rank) DO NOTHING
    RETURNING id, student_id, points
  )
  INSERT INTO public.loyalty_ledger (student_id, points_delta, reason, ref_id)
  SELECT i.student_id, i.points, 'leaderboard', i.id
  FROM inserted i;
END;
$$;

COMMENT ON FUNCTION public.award_monthly_leaderboard() IS
  'Awards previous-month top-3 leaderboard winners loyalty points. Idempotent. Uses row_number() tie-break to avoid UNIQUE(month,category,rank) collisions.';
