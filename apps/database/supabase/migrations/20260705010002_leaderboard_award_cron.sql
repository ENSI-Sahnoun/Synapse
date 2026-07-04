CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Award top-3 of the PREVIOUS calendar month per enabled category.
-- Idempotent: UNIQUE(month,category,rank) + ON CONFLICT DO NOTHING.
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
           rank() OVER (PARTITION BY m.category ORDER BY m.value DESC) AS rnk
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

REVOKE ALL ON FUNCTION public.award_monthly_leaderboard() FROM public;

-- Run at 00:05 on the 1st of each month.
SELECT cron.schedule(
  'award-monthly-leaderboard',
  '5 0 1 * *',
  $$ SELECT public.award_monthly_leaderboard(); $$
);

COMMENT ON FUNCTION public.award_monthly_leaderboard() IS
  'Awards previous-month top-3 leaderboard winners loyalty points. Idempotent.';
