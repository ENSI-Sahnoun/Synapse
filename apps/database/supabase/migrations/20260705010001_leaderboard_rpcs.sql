-- Leaderboard ranking RPCs. SECURITY DEFINER so students can read cross-student
-- aggregates without a per-row SELECT policy on attendance/purchases.

-- Per-category metric value for every eligible (non-opted-out) student in the month.
-- Returns rows only for categories that are currently enabled.
CREATE OR REPLACE FUNCTION public._leaderboard_metrics(p_month date)
RETURNS TABLE (category text, student_id uuid, full_name text, value numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH bounds AS (
    SELECT date_trunc('month', p_month::timestamptz) AS m_start,
           date_trunc('month', p_month::timestamptz) + interval '1 month' AS m_end
  ),
  elig AS (
    SELECT id, full_name FROM public.profiles
    WHERE role = 'student' AND leaderboard_opt_out = false
  ),
  visits AS (
    SELECT 'visits'::text AS category, e.id AS student_id, e.full_name,
           count(a.id)::numeric AS value
    FROM elig e
    LEFT JOIN public.attendance a
      ON a.student_id = e.id
     AND a.checked_in_at >= (SELECT m_start FROM bounds)
     AND a.checked_in_at <  (SELECT m_end FROM bounds)
    GROUP BY e.id, e.full_name
  ),
  hours AS (
    SELECT 'hours'::text AS category, e.id AS student_id, e.full_name,
           COALESCE(sum(
             EXTRACT(EPOCH FROM (a.checked_out_at - a.checked_in_at)) / 3600.0
           ), 0)::numeric AS value
    FROM elig e
    LEFT JOIN public.attendance a
      ON a.student_id = e.id
     AND a.checked_out_at IS NOT NULL
     AND a.checked_in_at >= (SELECT m_start FROM bounds)
     AND a.checked_in_at <  (SELECT m_end FROM bounds)
    GROUP BY e.id, e.full_name
  ),
  spend AS (
    SELECT 'spend'::text AS category, e.id AS student_id, e.full_name,
           COALESCE(sum(p.total_dt), 0)::numeric AS value
    FROM elig e
    LEFT JOIN public.purchases p
      ON p.student_id = e.id
     AND p.created_at >= (SELECT m_start FROM bounds)
     AND p.created_at <  (SELECT m_end FROM bounds)
    GROUP BY e.id, e.full_name
  ),
  all_metrics AS (
    SELECT * FROM visits
    UNION ALL SELECT * FROM hours
    UNION ALL SELECT * FROM spend
  )
  SELECT am.category, am.student_id, am.full_name, am.value
  FROM all_metrics am
  JOIN public.leaderboard_config c ON c.category = am.category
  WHERE c.enabled = true;
$$;

-- Top-N per enabled category. N comes from settings.leaderboard_list_size.
CREATE OR REPLACE FUNCTION public.get_leaderboard(p_month date)
RETURNS TABLE (
  category text, label text, emoji text,
  rank int, student_id uuid, full_name text, value numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH lim AS (
    SELECT COALESCE(NULLIF(value,'')::int, 10) AS n
    FROM public.settings WHERE key = 'leaderboard_list_size'
  ),
  ranked AS (
    SELECT m.category, m.student_id, m.full_name, m.value,
           rank() OVER (PARTITION BY m.category ORDER BY m.value DESC) AS rank
    FROM public._leaderboard_metrics(p_month) m
    WHERE m.value > 0
  )
  SELECT r.category, c.label, c.emoji, r.rank::int, r.student_id, r.full_name, r.value
  FROM ranked r
  JOIN public.leaderboard_config c ON c.category = r.category
  WHERE r.rank <= COALESCE((SELECT n FROM lim), 10)
  ORDER BY c.sort_order, r.rank, r.full_name;
$$;

-- The calling user's own rank+value per enabled category (full population).
CREATE OR REPLACE FUNCTION public.get_my_leaderboard_rank(p_month date)
RETURNS TABLE (category text, rank int, value numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH ranked AS (
    SELECT m.category, m.student_id, m.value,
           rank() OVER (PARTITION BY m.category ORDER BY m.value DESC) AS rank
    FROM public._leaderboard_metrics(p_month) m
  )
  SELECT r.category,
         CASE WHEN r.value > 0 THEN r.rank::int ELSE NULL END AS rank,
         r.value
  FROM ranked r
  WHERE r.student_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public._leaderboard_metrics(date) FROM public;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_leaderboard_rank(date) TO authenticated;
