-- Achievements & levels: admin-authored milestones that auto-unlock from
-- real-time activity (check-in, checkout, purchase), credit loyalty points,
-- and drive a Duolingo-style level. See docs/superpowers/specs/2026-07-21-
-- achievements-gamification-design.md for the full design.

-- ── Schema ──────────────────────────────────────────────────────────────

CREATE TABLE public.achievements (
  id          uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  category    text        NOT NULL CHECK (category IN ('visits', 'hours', 'spend', 'purchase_count', 'streak', 'manual')),
  threshold   numeric,
  points      int         NOT NULL CHECK (points >= 0),
  title       text        NOT NULL,
  description text,
  emoji       text        NOT NULL DEFAULT '🏆',
  sort_order  int         NOT NULL DEFAULT 0,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT achievements_threshold_shape CHECK (
    (category = 'manual' AND threshold IS NULL) OR (category <> 'manual' AND threshold IS NOT NULL)
  )
);

CREATE TRIGGER set_achievements_updated_at
  BEFORE UPDATE ON public.achievements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "achievements_select" ON public.achievements
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "achievements_admin_write" ON public.achievements
  FOR ALL TO authenticated
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');

CREATE TABLE public.achievement_unlocks (
  id             uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  student_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_id uuid        NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, achievement_id)
);

CREATE INDEX achievement_unlocks_student_idx ON public.achievement_unlocks (student_id);

ALTER TABLE public.achievement_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "achievement_unlocks_select" ON public.achievement_unlocks
  FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR current_user_role() IN ('admin', 'employee'));

-- No client-facing insert/update/delete policy — every write goes through
-- SECURITY DEFINER functions below (evaluator triggers + admin grant RPC).

CREATE TABLE public.levels (
  level       int  PRIMARY KEY,
  xp_required int  NOT NULL CHECK (xp_required >= 0),
  label       text
);

ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "levels_select" ON public.levels
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "levels_admin_write" ON public.levels
  FOR ALL TO authenticated
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');

-- Achievements are a new loyalty_ledger point source.
ALTER TABLE public.loyalty_ledger
  DROP CONSTRAINT loyalty_ledger_reason_check;

ALTER TABLE public.loyalty_ledger
  ADD CONSTRAINT loyalty_ledger_reason_check
  CHECK (reason IN ('subscription', 'redemption', 'adjustment', 'purchase', 'leaderboard', 'achievement'));

-- Structured progress data so the UI can render an actual bar instead of
-- parsing "8/10" out of the message text. Only populated for type
-- 'achievement_progress'; null for every other notification type.
ALTER TABLE public.notifications
  ADD COLUMN progress_current numeric,
  ADD COLUMN progress_target numeric;

-- Two new notification types for achievement progress/unlock.
ALTER TABLE public.notifications
  DROP CONSTRAINT notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'expiry_7d', 'expiry_3d', 'expiry_1d', 'expired', 'renewal_reminder',
    'reservation_confirmed', 'reservation_new', 'reservation_cancelled', 'reservation_accepted',
    'points_earned',
    'purchase_completed',
    'subscription_new',
    'loyalty_request_new',
    'loyalty_fulfilled',
    'loyalty_rejected',
    'room_almost_full',
    'seat_swap_request_new',
    'seat_swap_accepted',
    'seat_swap_denied',
    'announcement_new',
    'seat_removed_by_staff',
    'seat_changed_freely',
    'qr_airdrop',
    'kiosk_qr_drop',
    'kiosk_qr_drop_cancel',
    'locker_free_reminder',
    'achievement_progress',
    'achievement_unlocked'
  ));

-- Allow the two new types through the channel-config toggle too.
ALTER TABLE public.notification_channel_config
  DROP CONSTRAINT notification_channel_config_notification_type_check;

ALTER TABLE public.notification_channel_config
  ADD CONSTRAINT notification_channel_config_notification_type_check
  CHECK (notification_type IN (
    'expiry_7d', 'expiry_3d', 'expiry_1d', 'expired', 'renewal_reminder',
    'reservation_confirmed', 'reservation_new', 'reservation_cancelled', 'reservation_accepted',
    'points_earned', 'purchase_completed', 'subscription_new',
    'loyalty_request_new', 'loyalty_fulfilled', 'loyalty_rejected',
    'room_almost_full',
    'seat_swap_request_new', 'seat_swap_accepted', 'seat_swap_denied',
    'announcement_new', 'seat_removed_by_staff', 'seat_changed_freely',
    'achievement_progress', 'achievement_unlocked'
  ));

-- ── Levels & XP helpers ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.student_achievement_xp(p_student_id uuid)
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(points_delta), 0)::int
  FROM public.loyalty_ledger
  WHERE student_id = p_student_id AND reason = 'achievement';
$$;

CREATE OR REPLACE FUNCTION public.student_level(p_student_id uuid)
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT max(level) FROM public.levels WHERE xp_required <= public.student_achievement_xp(p_student_id)),
    1
  );
$$;

CREATE OR REPLACE FUNCTION public.get_levels_for_students(p_student_ids uuid[])
RETURNS TABLE (student_id uuid, level int, xp int)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, public.student_level(s.id), public.student_achievement_xp(s.id)
  FROM unnest(p_student_ids) AS s(id);
$$;

-- ── Real-time evaluator ─────────────────────────────────────────────────
-- Called from triggers on attendance/purchases. Computes current metrics,
-- unlocks any newly-crossed achievements (+ loyalty credit + notification),
-- and — for categories that just changed — notifies progress toward the
-- nearest still-locked milestone. Never blocks the triggering write: any
-- failure is caught and logged, not re-raised.

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
          format('%s Succès débloqué : « %s » (+%s pts)', v_achievement.emoji, v_achievement.title, v_achievement.points),
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
          format('%s %s/%s vers « %s »',
            v_next.emoji,
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

-- ── Triggers ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_evaluate_achievements_checkin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.evaluate_achievements_for_student(NEW.student_id, ARRAY['visits', 'streak']);
  RETURN NEW;
END;
$$;

CREATE TRIGGER achievements_on_checkin
  AFTER INSERT ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.trg_evaluate_achievements_checkin();

CREATE OR REPLACE FUNCTION public.trg_evaluate_achievements_checkout()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.checked_out_at IS NOT NULL AND OLD.checked_out_at IS NULL THEN
    PERFORM public.evaluate_achievements_for_student(NEW.student_id, ARRAY['hours']);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER achievements_on_checkout
  AFTER UPDATE OF checked_out_at ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.trg_evaluate_achievements_checkout();

CREATE OR REPLACE FUNCTION public.trg_evaluate_achievements_purchase()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.student_id IS NOT NULL THEN
    PERFORM public.evaluate_achievements_for_student(NEW.student_id, ARRAY['spend', 'purchase_count']);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER achievements_on_purchase
  AFTER INSERT ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.trg_evaluate_achievements_purchase();

-- ── Read API ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_achievements()
RETURNS TABLE (
  id uuid, category text, threshold numeric, points int, title text,
  description text, emoji text, sort_order int,
  unlocked boolean, unlocked_at timestamptz, progress numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student        uuid := auth.uid();
  v_visits         int;
  v_hours          numeric;
  v_spend          numeric;
  v_purchase_count int;
  v_streak         int;
BEGIN
  SELECT count(*) INTO v_visits FROM public.attendance WHERE student_id = v_student;

  SELECT COALESCE(SUM(EXTRACT(epoch FROM (checked_out_at - checked_in_at)) / 3600.0), 0)
    INTO v_hours
    FROM public.attendance
    WHERE student_id = v_student AND checked_out_at IS NOT NULL;

  SELECT COALESCE(SUM(total_dt), 0), count(*)
    INTO v_spend, v_purchase_count
    FROM public.purchases
    WHERE student_id = v_student AND voided_at IS NULL;

  WITH days AS (
    SELECT DISTINCT (checked_in_at AT TIME ZONE 'Africa/Tunis')::date AS d
    FROM public.attendance
    WHERE student_id = v_student
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
  LEFT JOIN public.achievement_unlocks u ON u.achievement_id = a.id AND u.student_id = v_student
  WHERE a.is_active
  ORDER BY a.sort_order;
END;
$$;

-- Social proof for the tree UI: "Youssef and 4 others" per achievement.
-- Callable by any authenticated user (students see who else unlocked what,
-- locked or not) — bypasses achievement_unlocks' own-row-only RLS on purpose.
CREATE OR REPLACE FUNCTION public.get_achievement_unlockers(p_achievement_ids uuid[])
RETURNS TABLE (achievement_id uuid, total_count int, sample_names text[])
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.achievement_id,
    count(*)::int AS total_count,
    (array_agg(p.full_name ORDER BY u.unlocked_at ASC))[1:3] AS sample_names
  FROM public.achievement_unlocks u
  JOIN public.profiles p ON p.id = u.student_id
  WHERE u.achievement_id = ANY(p_achievement_ids)
  GROUP BY u.achievement_id;
$$;

-- ── Admin manual award ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_grant_achievement(p_student_id uuid, p_achievement_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points    int;
  v_title     text;
  v_emoji     text;
  v_unlock_id uuid;
BEGIN
  IF current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT points, title, emoji INTO v_points, v_title, v_emoji
  FROM public.achievements
  WHERE id = p_achievement_id AND category = 'manual' AND is_active;

  IF v_points IS NULL THEN
    RAISE EXCEPTION 'Succès manuel introuvable';
  END IF;

  INSERT INTO public.achievement_unlocks (student_id, achievement_id)
  VALUES (p_student_id, p_achievement_id)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_unlock_id;

  IF v_unlock_id IS NULL THEN
    RAISE EXCEPTION 'Déjà débloqué pour cet étudiant';
  END IF;

  INSERT INTO public.loyalty_ledger (student_id, points_delta, reason, ref_id)
  VALUES (p_student_id, v_points, 'achievement', v_unlock_id);

  INSERT INTO public.notifications (user_id, type, message, link)
  VALUES (
    p_student_id, 'achievement_unlocked',
    format('%s Succès débloqué : « %s » (+%s pts)', v_emoji, v_title, v_points),
    '/student/rewards'
  );
END;
$$;

-- ── Seed data ───────────────────────────────────────────────────────────

INSERT INTO public.levels (level, xp_required, label) VALUES
  (1, 0,    'Débutant'),
  (2, 30,   'Novice'),
  (3, 70,   'Apprenti'),
  (4, 120,  'Habitué'),
  (5, 200,  'Régulier'),
  (6, 300,  'Assidu'),
  (7, 450,  'Expert'),
  (8, 650,  'Vétéran'),
  (9, 900,  'Maître'),
  (10, 1200, 'Légende')
ON CONFLICT DO NOTHING;

-- Each trackable category is a 5-tier ladder (I–V) sharing one title, so
-- there's always a next node to chase — sort_order groups by category then
-- tier, which is what the tree UI walks to draw each branch in order.
INSERT INTO public.achievements (category, threshold, points, title, description, emoji, sort_order) VALUES
  ('visits', 1,   10,  'Habitué I',   '1 visite au total.',                 '🚪', 10),
  ('visits', 10,  30,  'Habitué II',  '10 visites au total.',               '🚪', 11),
  ('visits', 25,  60,  'Habitué III', '25 visites au total.',               '🚪', 12),
  ('visits', 50,  120, 'Habitué IV',  '50 visites au total.',               '🚪', 13),
  ('visits', 100, 250, 'Habitué V',   '100 visites au total.',              '🏛️', 14),

  ('hours', 5,   15,  'Studieux I',   '5 heures cumulées sur place.',       '📚', 20),
  ('hours', 10,  25,  'Studieux II',  '10 heures cumulées sur place.',      '📚', 21),
  ('hours', 25,  60,  'Studieux III', '25 heures cumulées sur place.',      '📚', 22),
  ('hours', 50,  120, 'Studieux IV',  '50 heures cumulées sur place.',      '📖', 23),
  ('hours', 100, 250, 'Studieux V',   '100 heures cumulées sur place.',     '🏃', 24),

  ('streak', 2,  10,  'Assidu I',   '2 jours de suite.',                    '🔥', 30),
  ('streak', 3,  20,  'Assidu II',  '3 jours de suite.',                    '🔥', 31),
  ('streak', 7,  60,  'Assidu III', '7 jours de suite.',                    '🔥', 32),
  ('streak', 14, 150, 'Assidu IV',  '14 jours de suite.',                   '🔥', 33),
  ('streak', 30, 400, 'Assidu V',   '30 jours de suite.',                   '🌋', 34),

  ('spend', 10,  10,  'Gourmand I',   '10 DT dépensés au total.',           '🥐', 40),
  ('spend', 20,  15,  'Gourmand II',  '20 DT dépensés au total.',           '🥐', 41),
  ('spend', 50,  40,  'Gourmand III', '50 DT dépensés au total.',           '🍔', 42),
  ('spend', 100, 80,  'Gourmand IV',  '100 DT dépensés au total.',          '💳', 43),
  ('spend', 250, 200, 'Gourmand V',   '250 DT dépensés au total.',          '💎', 44),

  ('purchase_count', 5,   10,  'Client fidèle I',   '5 achats effectués.',    '🛍️', 50),
  ('purchase_count', 10,  25,  'Client fidèle II',  '10 achats effectués.',   '🛍️', 51),
  ('purchase_count', 25,  60,  'Client fidèle III', '25 achats effectués.',   '🛒', 52),
  ('purchase_count', 50,  120, 'Client fidèle IV',  '50 achats effectués.',   '🛒', 53),
  ('purchase_count', 100, 250, 'Client fidèle V',   '100 achats effectués.',  '👑', 54),

  ('manual', NULL, 50, 'Bénévole', 'Aide exceptionnelle apportée à Synapse.', '🌟', 200)
ON CONFLICT DO NOTHING;

-- ── One-time backfill ───────────────────────────────────────────────────
-- Run the evaluator once for every existing student so anyone who already
-- qualifies for a seeded milestone gets credited immediately. Progress
-- notifications are suppressed here to avoid a mass-notify on deploy.

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE role = 'student' LOOP
    PERFORM public.evaluate_achievements_for_student(
      r.id,
      ARRAY['visits', 'hours', 'spend', 'purchase_count', 'streak'],
      false
    );
  END LOOP;
END $$;
