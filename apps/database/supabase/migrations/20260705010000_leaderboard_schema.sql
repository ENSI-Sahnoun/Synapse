-- Student gamification scoreboard: config, awards ledger, opt-out, reason.

-- 1. Per-student opt-out
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS leaderboard_opt_out boolean NOT NULL DEFAULT false;

-- 2. Per-category admin config
CREATE TABLE public.leaderboard_config (
  category   text    PRIMARY KEY CHECK (category IN ('visits','hours','spend')),
  enabled    boolean NOT NULL DEFAULT true,
  label      text    NOT NULL,
  emoji      text    NOT NULL,
  points_1   int     NOT NULL DEFAULT 100 CHECK (points_1 >= 0),
  points_2   int     NOT NULL DEFAULT 50  CHECK (points_2 >= 0),
  points_3   int     NOT NULL DEFAULT 25  CHECK (points_3 >= 0),
  sort_order int     NOT NULL DEFAULT 0
);

INSERT INTO public.leaderboard_config (category, label, emoji, sort_order) VALUES
  ('visits', 'Assidus',      '🔥', 0),
  ('hours',  'Marathoniens', '⏱️', 1),
  ('spend',  'Top Clients',  '🛒', 2);

ALTER TABLE public.leaderboard_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leaderboard_config_select" ON public.leaderboard_config
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "leaderboard_config_insert" ON public.leaderboard_config
  FOR INSERT WITH CHECK (current_user_role() = 'admin');
CREATE POLICY "leaderboard_config_update" ON public.leaderboard_config
  FOR UPDATE USING (current_user_role() = 'admin');
CREATE POLICY "leaderboard_config_delete" ON public.leaderboard_config
  FOR DELETE USING (current_user_role() = 'admin');

-- 3. Global flags (reuse existing settings KV table)
INSERT INTO public.settings (key, value) VALUES
  ('leaderboard_enabled',      'true'),
  ('leaderboard_prize_secret', 'false'),
  ('leaderboard_list_size',    '10')
ON CONFLICT (key) DO NOTHING;

-- 4. Awards ledger + idempotency guard
CREATE TABLE public.leaderboard_awards (
  id         uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  month      date        NOT NULL,
  category   text        NOT NULL,
  rank       int         NOT NULL CHECK (rank BETWEEN 1 AND 3),
  student_id uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  points     int         NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (month, category, rank)
);

CREATE INDEX leaderboard_awards_student_idx
  ON public.leaderboard_awards (student_id, month DESC);

ALTER TABLE public.leaderboard_awards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leaderboard_awards_select" ON public.leaderboard_awards
  FOR SELECT USING (auth.uid() IS NOT NULL);
-- Writes happen only via the SECURITY DEFINER cron function; no anon/authenticated write policy.

-- 5. Allow 'leaderboard' as a loyalty_ledger reason
ALTER TABLE public.loyalty_ledger
  DROP CONSTRAINT IF EXISTS loyalty_ledger_reason_check;
ALTER TABLE public.loyalty_ledger
  ADD CONSTRAINT loyalty_ledger_reason_check
  CHECK (reason IN ('subscription', 'redemption', 'adjustment', 'purchase', 'leaderboard'));
