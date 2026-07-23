-- Achievements now render as icons (phosphor icon names) instead of emoji.
-- The `emoji` column is kept as-is (renaming touches too much call-site code
-- for the value); it now stores names resolved client-side via
-- apps/web/src/utils/achievement-icons.ts, with 'Trophy' as the fallback.

ALTER TABLE public.achievements ALTER COLUMN emoji SET DEFAULT 'Trophy';

-- Backfill the seeded ladder rows (matched by title, which is unique here)
-- to icon names that echo their original emoji.
UPDATE public.achievements SET emoji = 'DoorOpen'        WHERE title IN ('Habitué I', 'Habitué II', 'Habitué III', 'Habitué IV');
UPDATE public.achievements SET emoji = 'Buildings'       WHERE title = 'Habitué V';
UPDATE public.achievements SET emoji = 'BookOpen'        WHERE title IN ('Studieux I', 'Studieux II', 'Studieux III');
UPDATE public.achievements SET emoji = 'Book'            WHERE title = 'Studieux IV';
UPDATE public.achievements SET emoji = 'PersonSimpleRun' WHERE title = 'Studieux V';
UPDATE public.achievements SET emoji = 'Fire'            WHERE title IN ('Assidu I', 'Assidu II', 'Assidu III', 'Assidu IV');
UPDATE public.achievements SET emoji = 'Mountains'       WHERE title = 'Assidu V';
UPDATE public.achievements SET emoji = 'Coffee'          WHERE title = 'Gourmand I';
UPDATE public.achievements SET emoji = 'Cookie'          WHERE title = 'Gourmand II';
UPDATE public.achievements SET emoji = 'Hamburger'       WHERE title = 'Gourmand III';
UPDATE public.achievements SET emoji = 'CreditCard'      WHERE title = 'Gourmand IV';
UPDATE public.achievements SET emoji = 'Diamond'         WHERE title = 'Gourmand V';
UPDATE public.achievements SET emoji = 'ShoppingBag'     WHERE title IN ('Client fidèle I', 'Client fidèle II');
UPDATE public.achievements SET emoji = 'ShoppingCart'    WHERE title IN ('Client fidèle III', 'Client fidèle IV');
UPDATE public.achievements SET emoji = 'Crown'           WHERE title = 'Client fidèle V';
UPDATE public.achievements SET emoji = 'Sparkle'         WHERE title = 'Bénévole';

-- Catch-all: any other row (e.g. custom achievements created by an admin
-- through the old free-text emoji field) still holding a raw glyph falls
-- back to the default icon.
UPDATE public.achievements SET emoji = 'Trophy' WHERE emoji !~ '^[A-Za-z]+$';

-- Notification message text can't render an icon component, so the emoji
-- glyph previously prefixed there is dropped rather than replaced with an
-- icon name string; NotificationItem.tsx already shows a Trophy icon
-- alongside these notification types.
CREATE OR REPLACE FUNCTION public.evaluate_achievements_for_student(
  p_student_id uuid,
  p_changed_categories text[] DEFAULT ARRAY['visits', 'hours', 'spend', 'purchase_count', 'streak'],
  p_notify_progress boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_visits         int;
  v_hours          numeric;
  v_spend          numeric;
  v_purchase_count int;
  v_streak         int;
  v_old_level      int;
  v_new_level      int;
  v_achievement    record;
  v_next           record;
  v_metric         numeric;
  v_unlock_id      uuid;
BEGIN
  SELECT count(*) INTO v_visits FROM public.attendance WHERE student_id = p_student_id;

  SELECT COALESCE(SUM(EXTRACT(epoch FROM (checked_out_at - checked_in_at)) / 3600.0), 0)
    INTO v_hours
    FROM public.attendance
    WHERE student_id = p_student_id AND checked_out_at IS NOT NULL;

  SELECT COALESCE(SUM(total_dt), 0)
    INTO v_spend
    FROM public.purchases
    WHERE student_id = p_student_id AND voided_at IS NULL;

  -- purchase_count deliberately excludes POS purchases — it tracks
  -- subscriptions and locker rentals only, not counter sales.
  SELECT
    (SELECT count(*) FROM public.subscriptions WHERE student_id = p_student_id AND voided_at IS NULL)
    + (SELECT count(*) FROM public.locker_payments lp WHERE lp.student_id = p_student_id
         AND NOT EXISTS (SELECT 1 FROM public.refunds r WHERE r.locker_payment_id = lp.id))
    INTO v_purchase_count;

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

  v_old_level := public.student_level(p_student_id);

  FOR v_achievement IN
    SELECT * FROM public.achievements
    WHERE is_active AND category <> 'manual'
      AND id NOT IN (SELECT achievement_id FROM public.achievement_unlocks WHERE student_id = p_student_id)
    ORDER BY sort_order
  LOOP
    v_metric := CASE v_achievement.category
      WHEN 'visits' THEN v_visits
      WHEN 'hours' THEN v_hours
      WHEN 'spend' THEN v_spend
      WHEN 'purchase_count' THEN v_purchase_count
      WHEN 'streak' THEN v_streak
    END;

    IF v_metric >= v_achievement.threshold THEN
      v_unlock_id := NULL;
      INSERT INTO public.achievement_unlocks (student_id, achievement_id)
      VALUES (p_student_id, v_achievement.id)
      ON CONFLICT DO NOTHING
      RETURNING id INTO v_unlock_id;

      IF v_unlock_id IS NOT NULL THEN
        INSERT INTO public.loyalty_ledger (student_id, points_delta, reason, ref_id)
        VALUES (p_student_id, v_achievement.points, 'achievement', v_unlock_id);

        INSERT INTO public.notifications (user_id, type, message, link)
        VALUES (
          p_student_id, 'achievement_unlocked',
          format('Succès débloqué : « %s » (+%s pts)', v_achievement.title, v_achievement.points),
          '/student/rewards'
        );
      END IF;
    END IF;
  END LOOP;

  IF p_notify_progress THEN
    FOR v_next IN
      SELECT DISTINCT ON (category) *
      FROM public.achievements
      WHERE is_active AND category <> 'manual'
        AND category = ANY(p_changed_categories)
        AND id NOT IN (SELECT achievement_id FROM public.achievement_unlocks WHERE student_id = p_student_id)
      ORDER BY category, threshold ASC
    LOOP
      v_metric := CASE v_next.category
        WHEN 'visits' THEN v_visits
        WHEN 'hours' THEN v_hours
        WHEN 'spend' THEN v_spend
        WHEN 'purchase_count' THEN v_purchase_count
        WHEN 'streak' THEN v_streak
      END;

      IF v_metric > 0 AND v_metric < v_next.threshold THEN
        INSERT INTO public.notifications (user_id, type, message, link, progress_current, progress_target)
        VALUES (
          p_student_id, 'achievement_progress',
          format('%s/%s vers « %s »',
            trim(to_char(v_metric, 'FM999999990.##')),
            trim(to_char(v_next.threshold, 'FM999999990.##')),
            v_next.title),
          '/student/rewards',
          v_metric, v_next.threshold
        );
      END IF;
    END LOOP;
  END IF;

  v_new_level := public.student_level(p_student_id);
  IF v_new_level > v_old_level THEN
    INSERT INTO public.notifications (user_id, type, message, link)
    VALUES (p_student_id, 'achievement_unlocked', format('🎉 Niveau %s atteint !', v_new_level), '/student/rewards');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'evaluate_achievements_for_student failed for %: %', p_student_id, SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_achievements_for_student(uuid, text[], boolean) FROM public;
