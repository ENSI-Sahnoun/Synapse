-- Public profile page (/profile/[id]) needs to show any student's unlocked
-- achievements and loyalty balance, not just the viewer's own. Both
-- loyalty_ledger and achievement_unlocks are own-row-only via RLS, so expose
-- narrow SECURITY DEFINER RPCs — same pattern as get_achievement_unlockers.

CREATE OR REPLACE FUNCTION public.get_achievements_for_student(p_student_id uuid)
RETURNS TABLE (
  id uuid, category text, threshold numeric, points int, title text,
  description text, emoji text, sort_order int,
  unlocked boolean, unlocked_at timestamptz, progress numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_visits         int;
  v_hours          numeric;
  v_spend          numeric;
  v_purchase_count int;
  v_streak         int;
BEGIN
  SELECT count(*) INTO v_visits FROM public.attendance WHERE student_id = p_student_id;

  SELECT COALESCE(SUM(EXTRACT(epoch FROM (checked_out_at - checked_in_at)) / 3600.0), 0)
    INTO v_hours
    FROM public.attendance
    WHERE student_id = p_student_id AND checked_out_at IS NOT NULL;

  SELECT COALESCE(SUM(total_dt), 0), count(*)
    INTO v_spend, v_purchase_count
    FROM public.purchases
    WHERE student_id = p_student_id AND voided_at IS NULL;

  WITH days AS (
    SELECT DISTINCT (checked_in_at AT TIME ZONE 'Africa/Tunis')::date AS d
    FROM public.attendance
    WHERE student_id = p_student_id
  ),
  ranked AS (
    SELECT d, d - (row_number() OVER (ORDER BY d))::int AS grp FROM days
  )
  SELECT count(*) INTO v_streak
  FROM ranked
  WHERE grp = (SELECT grp FROM ranked ORDER BY d DESC LIMIT 1);
  v_streak := COALESCE(v_streak, 0);

  RETURN QUERY
  SELECT
    a.id, a.category, a.threshold, a.points, a.title, a.description, a.emoji, a.sort_order,
    (u.id IS NOT NULL) AS unlocked,
    u.unlocked_at,
    CASE
      WHEN u.id IS NOT NULL THEN 1.0
      WHEN a.category = 'manual' THEN 0.0
      ELSE LEAST(1.0, GREATEST(0.0,
        (CASE a.category
          WHEN 'visits' THEN v_visits
          WHEN 'hours' THEN v_hours
          WHEN 'spend' THEN v_spend
          WHEN 'purchase_count' THEN v_purchase_count
          WHEN 'streak' THEN v_streak
        END) / NULLIF(a.threshold, 0)
      ))
    END AS progress
  FROM public.achievements a
  LEFT JOIN public.achievement_unlocks u ON u.achievement_id = a.id AND u.student_id = p_student_id
  WHERE a.is_active
  ORDER BY a.sort_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_loyalty_balance_for_student(p_student_id uuid)
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(points_delta), 0)::int
  FROM public.loyalty_ledger
  WHERE student_id = p_student_id;
$$;
