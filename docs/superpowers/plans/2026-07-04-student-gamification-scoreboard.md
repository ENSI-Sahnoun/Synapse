# Student Gamification Scoreboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a monthly, admin-configurable scoreboard to the student dashboard that ranks students by visits / hours / spend, shows a podium for the top 3, and auto-awards Synapse loyalty points to winners at month end.

**Architecture:** Postgres `SECURITY DEFINER` RPCs compute rankings across all students (bypassing per-row RLS), reading config from a `leaderboard_config` table and the existing `settings` KV table. A `pg_cron` job awards points into `loyalty_ledger` on the 1st of each month, guarded for idempotency by a `leaderboard_awards` table. The Next.js (App Router, RSC) student dashboard renders a phone-first card with tabs, a podium, a ranked list, and the caller's own rank. Admins manage every parameter under `/admin/settings/leaderboard`.

**Tech Stack:** Postgres + pg_cron (Supabase), Next.js 16 App Router / React 19 RSC, `next-safe-action`, Tailwind 4, `@phosphor-icons/react`, `sonner` toasts, `@supabase/ssr`.

## Global Constraints

- Migrations live in `apps/database/supabase/migrations/`, named `YYYYMMDDHHMMSS_snake_case.sql`. Use timestamps after the latest existing one (`20260705000005_*`); this plan uses the `20260705010000`–`20260705010002` block.
- RPCs that read across all students MUST be `SECURITY DEFINER`, `SET search_path = public, extensions`, and `GRANT EXECUTE ... TO authenticated`. Mirror `20260704100000_analytics_rpcs.sql`.
- Admin-only writes gated by `current_user_role() = 'admin'` (SQL RLS) AND `adminActionClient` (web). Student self-writes gated by `studentActionClient`.
- Web Supabase clients are typed with `Database` from `src/lib/database.types.ts`. This file is hand-maintained — every new table, column, and RPC MUST be added there or `.from()`/`.rpc()` calls will be typed `never`.
- UI copy is French, matching existing student/admin UI.
- Calendar-month window and top-3 awarded ranks are fixed (not configurable). Everything else (enable per category, labels, emojis, point values, list size, master switch, secret-prize) is admin-configurable.
- `loyalty_ledger.reason` is an enum CHECK with no free-text column — the awarding reason is the enum value `'leaderboard'` and `ref_id` points to the `leaderboard_awards` row. Human-readable award text is built at display time, not stored in the ledger.

---

## File Structure

**Database (create):**
- `apps/database/supabase/migrations/20260705010000_leaderboard_schema.sql` — opt-out column, `leaderboard_config`, `settings` seeds, `leaderboard_awards`, `loyalty_ledger` reason extension.
- `apps/database/supabase/migrations/20260705010001_leaderboard_rpcs.sql` — `get_leaderboard`, `get_my_leaderboard_rank`.
- `apps/database/supabase/migrations/20260705010002_leaderboard_award_cron.sql` — `award_monthly_leaderboard()` + cron schedule.

**Web (create):**
- `apps/web/src/data/student/leaderboard.ts` — RSC data functions.
- `apps/web/src/actions/student/leaderboard-optout.ts` — student opt-out toggle action.
- `apps/web/src/actions/admin/leaderboard-config.ts` — admin config actions.
- `apps/web/src/app/student/dashboard/LeaderboardCard.tsx` — client component (tabs, podium, list, my-rank).
- `apps/web/src/app/admin/settings/leaderboard/page.tsx` — admin config page (RSC).
- `apps/web/src/app/admin/settings/leaderboard/LeaderboardSettingsCards.tsx` — admin config client cards.

**Web (modify):**
- `apps/web/src/lib/database.types.ts` — add new tables + RPC signatures.
- `apps/web/src/app/student/dashboard/page.tsx` — render `<LeaderboardCard>`.
- `apps/web/src/app/student/settings/StudentSettingsClient.tsx` — add opt-out switch.
- `apps/web/src/app/student/settings/page.tsx` — pass `initialOptOut` (verify prop plumbing).
- `apps/web/src/actions/student/account.ts` — add opt-out action here OR keep separate file (this plan uses a separate file).
- `apps/web/src/app/admin/settings/page.tsx` — add a link to the leaderboard settings page.

---

## Task 1: Database schema (config, awards, opt-out, reason)

**Files:**
- Create: `apps/database/supabase/migrations/20260705010000_leaderboard_schema.sql`

**Interfaces:**
- Produces: `profiles.leaderboard_opt_out boolean`; table `public.leaderboard_config(category, enabled, label, emoji, points_1, points_2, points_3, sort_order)`; table `public.leaderboard_awards(id, month, category, rank, student_id, points, created_at)` UNIQUE`(month,category,rank)`; `settings` keys `leaderboard_enabled`, `leaderboard_prize_secret`, `leaderboard_list_size`; `loyalty_ledger.reason` accepts `'leaderboard'`.

- [ ] **Step 1: Write the migration**

Create `apps/database/supabase/migrations/20260705010000_leaderboard_schema.sql`:

```sql
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
```

- [ ] **Step 2: Apply and verify the schema**

Run (local Supabase must be running — `pnpm database#start`):
```bash
cd apps/database && supabase migration up --local
```
Expected: migration applies with no error.

Verify seeds and column:
```bash
psql "$SUPABASE_DB_URL" -c "SELECT category, enabled, label, points_1 FROM public.leaderboard_config ORDER BY sort_order;"
psql "$SUPABASE_DB_URL" -c "SELECT key, value FROM public.settings WHERE key LIKE 'leaderboard_%';"
psql "$SUPABASE_DB_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_name='profiles' AND column_name='leaderboard_opt_out';"
```
Expected: 3 config rows, 3 settings rows, 1 column row.

(If `$SUPABASE_DB_URL` is not set, use the local connection string printed by `supabase status`.)

- [ ] **Step 3: Commit**

```bash
git add apps/database/supabase/migrations/20260705010000_leaderboard_schema.sql
git commit -m "feat(db): leaderboard config, awards ledger, opt-out column"
```

---

## Task 2: Ranking RPCs

**Files:**
- Create: `apps/database/supabase/migrations/20260705010001_leaderboard_rpcs.sql`

**Interfaces:**
- Consumes: tables from Task 1.
- Produces:
  - `public.get_leaderboard(p_month date)` → `TABLE(category text, label text, emoji text, rank int, student_id uuid, full_name text, value numeric)`.
  - `public.get_my_leaderboard_rank(p_month date)` → `TABLE(category text, rank int, value numeric)`.

Both compute the per-category metric over `[date_trunc('month', p_month), + 1 month)`, exclude opted-out students, and only include categories where `leaderboard_config.enabled`.

- [ ] **Step 1: Write the migration**

Create `apps/database/supabase/migrations/20260705010001_leaderboard_rpcs.sql`:

```sql
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
```

> Note: `_leaderboard_metrics` is a private helper (not granted to `authenticated`). Because `get_leaderboard`/`get_my_leaderboard_rank` are `SECURITY DEFINER` and owned by the migration role, they can call it regardless of the caller's grants.

- [ ] **Step 2: Apply and verify with seeded data**

Run:
```bash
cd apps/database && supabase migration up --local
```

Verify against current month (should run without error; may return 0 rows if no data):
```bash
psql "$SUPABASE_DB_URL" -c "SELECT category, rank, full_name, value FROM public.get_leaderboard(current_date) LIMIT 20;"
```
Expected: query succeeds, columns as specified.

Sanity-check ranking with a temp fixture (run, inspect, rollback):
```bash
psql "$SUPABASE_DB_URL" <<'SQL'
BEGIN;
-- Assumes at least two student profiles exist; adjust ids as needed.
WITH s AS (SELECT id FROM public.profiles WHERE role='student' ORDER BY created_at LIMIT 2)
INSERT INTO public.attendance (student_id, checked_in_at, checked_out_at, entry_method)
SELECT id, date_trunc('month', now()) + interval '2 day',
           date_trunc('month', now()) + interval '2 day 3 hours', 'manual'
FROM s;
SELECT category, rank, full_name, value FROM public.get_leaderboard(current_date)
WHERE category IN ('visits','hours') ORDER BY category, rank;
ROLLBACK;
SQL
```
Expected: the two inserted students appear in `visits` and `hours` with `value > 0`, ranked.

- [ ] **Step 3: Commit**

```bash
git add apps/database/supabase/migrations/20260705010001_leaderboard_rpcs.sql
git commit -m "feat(db): leaderboard ranking RPCs"
```

---

## Task 3: Month-end award cron

**Files:**
- Create: `apps/database/supabase/migrations/20260705010002_leaderboard_award_cron.sql`

**Interfaces:**
- Consumes: `_leaderboard_metrics`, `leaderboard_config`, `leaderboard_awards`, `loyalty_ledger`.
- Produces: `public.award_monthly_leaderboard()` (idempotent) + pg_cron job `award-monthly-leaderboard`.

- [ ] **Step 1: Write the migration**

Create `apps/database/supabase/migrations/20260705010002_leaderboard_award_cron.sql`:

```sql
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
```

- [ ] **Step 2: Apply and verify idempotency**

Run:
```bash
cd apps/database && supabase migration up --local
```

Test award + re-run within a transaction (uses last month; insert fixture data in last month, run twice, expect one set of awards):
```bash
psql "$SUPABASE_DB_URL" <<'SQL'
BEGIN;
WITH s AS (SELECT id FROM public.profiles WHERE role='student' ORDER BY created_at LIMIT 1)
INSERT INTO public.attendance (student_id, checked_in_at, checked_out_at, entry_method)
SELECT id, date_trunc('month', now()) - interval '1 month' + interval '3 day',
           date_trunc('month', now()) - interval '1 month' + interval '3 day 4 hours', 'manual'
FROM s;
SELECT public.award_monthly_leaderboard();
SELECT public.award_monthly_leaderboard(); -- second run must not double-insert
SELECT category, rank, points FROM public.leaderboard_awards
  WHERE month = (date_trunc('month', now()) - interval '1 month')::date
  ORDER BY category, rank;
SELECT count(*) AS ledger_rows FROM public.loyalty_ledger WHERE reason='leaderboard';
ROLLBACK;
SQL
```
Expected: awards present for `visits`/`hours` rank 1; running twice yields the same rows (no duplicates); `ledger_rows` matches award count.

Verify cron registered:
```bash
psql "$SUPABASE_DB_URL" -c "SELECT jobname, schedule FROM cron.job WHERE jobname='award-monthly-leaderboard';"
```
Expected: one row, schedule `5 0 1 * *`.

- [ ] **Step 3: Commit**

```bash
git add apps/database/supabase/migrations/20260705010002_leaderboard_award_cron.sql
git commit -m "feat(db): month-end leaderboard award cron"
```

---

## Task 4: Web types + data layer

**Files:**
- Modify: `apps/web/src/lib/database.types.ts`
- Create: `apps/web/src/data/student/leaderboard.ts`

**Interfaces:**
- Consumes: RPCs `get_leaderboard`, `get_my_leaderboard_rank`; tables `leaderboard_config`, `settings`.
- Produces (exact names/types used by Tasks 6 & 7):
  - `type LeaderboardCategory = 'visits' | 'hours' | 'spend'`
  - `type LeaderboardRow = { category: LeaderboardCategory; label: string; emoji: string; rank: number; student_id: string; full_name: string | null; value: number }`
  - `type LeaderboardConfigRow = { category: LeaderboardCategory; enabled: boolean; label: string; emoji: string; points_1: number; points_2: number; points_3: number; sort_order: number }`
  - `type LeaderboardSettings = { enabled: boolean; prizeSecret: boolean; listSize: number }`
  - `type MyRank = { category: LeaderboardCategory; rank: number | null; value: number }`
  - `async function getLeaderboard(): Promise<LeaderboardRow[]>`
  - `async function getMyLeaderboardRank(): Promise<MyRank[]>`
  - `async function getLeaderboardSettings(): Promise<LeaderboardSettings>`
  - `async function getLeaderboardConfig(): Promise<LeaderboardConfigRow[]>`

- [ ] **Step 1: Add types to `database.types.ts`**

In `apps/web/src/lib/database.types.ts`, under the `public.Tables` object add entries for the two new tables (follow the shape of existing table entries in that file — `Row`/`Insert`/`Update`):

```ts
leaderboard_config: {
  Row: { category: string; enabled: boolean; label: string; emoji: string; points_1: number; points_2: number; points_3: number; sort_order: number }
  Insert: { category: string; enabled?: boolean; label: string; emoji: string; points_1?: number; points_2?: number; points_3?: number; sort_order?: number }
  Update: { category?: string; enabled?: boolean; label?: string; emoji?: string; points_1?: number; points_2?: number; points_3?: number; sort_order?: number }
  Relationships: []
}
leaderboard_awards: {
  Row: { id: string; month: string; category: string; rank: number; student_id: string; points: number; created_at: string }
  Insert: { id?: string; month: string; category: string; rank: number; student_id: string; points: number; created_at?: string }
  Update: { id?: string; month?: string; category?: string; rank?: number; student_id?: string; points?: number; created_at?: string }
  Relationships: []
}
```

Add `leaderboard_opt_out: boolean` to the `profiles` `Row`, and `leaderboard_opt_out?: boolean` to its `Insert`/`Update`.

Under the `public.Functions` object add:

```ts
get_leaderboard: {
  Args: { p_month: string }
  Returns: { category: string; label: string; emoji: string; rank: number; student_id: string; full_name: string | null; value: number }[]
}
get_my_leaderboard_rank: {
  Args: { p_month: string }
  Returns: { category: string; rank: number | null; value: number }[]
}
```

- [ ] **Step 2: Typecheck the types edit**

Run:
```bash
cd apps/web && pnpm typecheck
```
Expected: PASS (no type errors introduced by the edited types file).

- [ ] **Step 3: Write the data layer**

Create `apps/web/src/data/student/leaderboard.ts`:

```ts
'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export type LeaderboardCategory = 'visits' | 'hours' | 'spend'

export type LeaderboardRow = {
  category: LeaderboardCategory
  label: string
  emoji: string
  rank: number
  student_id: string
  full_name: string | null
  value: number
}

export type LeaderboardConfigRow = {
  category: LeaderboardCategory
  enabled: boolean
  label: string
  emoji: string
  points_1: number
  points_2: number
  points_3: number
  sort_order: number
}

export type LeaderboardSettings = {
  enabled: boolean
  prizeSecret: boolean
  listSize: number
}

export type MyRank = { category: LeaderboardCategory; rank: number | null; value: number }

/** First day of the current calendar month, as an ISO date (YYYY-MM-DD). */
function currentMonthISO(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
}

export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.rpc('get_leaderboard', { p_month: currentMonthISO() })
  if (error) throw error
  return (data ?? []) as LeaderboardRow[]
}

export async function getMyLeaderboardRank(): Promise<MyRank[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.rpc('get_my_leaderboard_rank', { p_month: currentMonthISO() })
  if (error) throw error
  return (data ?? []) as MyRank[]
}

export async function getLeaderboardSettings(): Promise<LeaderboardSettings> {
  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['leaderboard_enabled', 'leaderboard_prize_secret', 'leaderboard_list_size'])
  const map = new Map((data ?? []).map((r) => [r.key, r.value]))
  return {
    enabled: (map.get('leaderboard_enabled') ?? 'true') === 'true',
    prizeSecret: (map.get('leaderboard_prize_secret') ?? 'false') === 'true',
    listSize: parseInt(map.get('leaderboard_list_size') ?? '10', 10),
  }
}

export async function getLeaderboardConfig(): Promise<LeaderboardConfigRow[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('leaderboard_config')
    .select('category, enabled, label, emoji, points_1, points_2, points_3, sort_order')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as LeaderboardConfigRow[]
}
```

- [ ] **Step 4: Typecheck**

Run:
```bash
cd apps/web && pnpm typecheck
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/database.types.ts apps/web/src/data/student/leaderboard.ts
git commit -m "feat(web): leaderboard db types and data layer"
```

---

## Task 5: Student opt-out action + settings toggle

**Files:**
- Create: `apps/web/src/actions/student/leaderboard-optout.ts`
- Modify: `apps/web/src/app/student/settings/StudentSettingsClient.tsx`
- Modify: `apps/web/src/app/student/settings/page.tsx`

**Interfaces:**
- Consumes: `studentActionClient` from `@/lib/safe-action`, `profiles.leaderboard_opt_out`.
- Produces: `setLeaderboardOptOut` action taking `{ optOut: boolean }`, returning `{ success: true, optOut: boolean }`.

- [ ] **Step 1: Write the action**

Create `apps/web/src/actions/student/leaderboard-optout.ts`:

```ts
'use server'

import { z } from 'zod'
import { studentActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'
import { revalidatePath } from 'next/cache'

const schema = z.object({ optOut: z.boolean() })

export const setLeaderboardOptOut = studentActionClient
  .schema(schema)
  .action(async ({ parsedInput: { optOut }, ctx: { userId } }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('profiles')
      .update({ leaderboard_opt_out: optOut })
      .eq('id', userId)
    if (error) throw new Error('Impossible de mettre à jour la préférence de classement.')
    revalidatePath('/student/settings')
    revalidatePath('/student/dashboard')
    return { success: true, optOut }
  })
```

- [ ] **Step 2: Pass current opt-out to the settings client**

In `apps/web/src/app/student/settings/page.tsx`, extend the profile select to include `leaderboard_opt_out` and pass it as a prop. Locate the existing `.select('...')` on `profiles` and add `leaderboard_opt_out`; then pass `initialOptOut={profile.leaderboard_opt_out}` to `<StudentSettingsClient .../>`. (Read the file first to match the exact prop-passing already in place.)

- [ ] **Step 3: Add the switch to `StudentSettingsClient.tsx`**

Add `initialOptOut: boolean` to the `Props` type. Inside the component, add state and the action hook near the other toggles:

```tsx
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'react-hot-toast'
import { setLeaderboardOptOut } from '@/actions/student/leaderboard-optout'
import { Trophy } from '@phosphor-icons/react'

// inside component body:
const [inLeaderboard, setInLeaderboard] = useState(!initialOptOut)
const { execute: execOptOut } = useAction(setLeaderboardOptOut, {
  onError: () => {
    setInLeaderboard((v) => !v) // revert
    toast.error('Erreur lors de la mise à jour.')
  },
})
function toggleLeaderboard(checked: boolean) {
  setInLeaderboard(checked) // optimistic; checked = appear on board = NOT opted out
  execOptOut({ optOut: !checked })
}
```

Render a row consistent with the existing settings rows (reuse the same markup pattern the file already uses for `<Switch>` rows — e.g. the notification toggle at line ~144):

```tsx
<div className="flex items-center justify-between py-3">
  <div className="flex items-center gap-3">
    <Trophy size={20} weight="duotone" />
    <div>
      <p className="text-sm font-medium">Apparaître dans le classement</p>
      <p className="text-xs text-muted-foreground">
        Votre nom peut figurer dans le classement mensuel des étudiants.
      </p>
    </div>
  </div>
  <Switch checked={inLeaderboard} onCheckedChange={toggleLeaderboard} aria-label="Apparaître dans le classement" />
</div>
```

> Verify which toast lib the file already imports; if it imports `sonner`, use that instead of `react-hot-toast` for consistency within the file.

- [ ] **Step 4: Typecheck**

Run:
```bash
cd apps/web && pnpm typecheck
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/actions/student/leaderboard-optout.ts apps/web/src/app/student/settings/StudentSettingsClient.tsx apps/web/src/app/student/settings/page.tsx
git commit -m "feat(web): student leaderboard opt-out toggle"
```

---

## Task 6: Admin config action + page

**Files:**
- Create: `apps/web/src/actions/admin/leaderboard-config.ts`
- Create: `apps/web/src/app/admin/settings/leaderboard/page.tsx`
- Create: `apps/web/src/app/admin/settings/leaderboard/LeaderboardSettingsCards.tsx`
- Modify: `apps/web/src/app/admin/settings/page.tsx`

**Interfaces:**
- Consumes: `adminActionClient`, `getLeaderboardSettings`, `getLeaderboardConfig`, `settings`, `leaderboard_config`.
- Produces: actions `setLeaderboardFlags({ enabled?, prizeSecret?, listSize? })` and `updateLeaderboardCategory({ category, enabled, label, emoji, points_1, points_2, points_3 })`.

- [ ] **Step 1: Write the admin actions**

Create `apps/web/src/actions/admin/leaderboard-config.ts`:

```ts
'use server'

import { z } from 'zod'
import { adminActionClient } from '@/lib/safe-action'
import { createSupabaseClient } from '@/supabase-clients/server'
import { revalidatePath } from 'next/cache'

const flagsSchema = z.object({
  enabled: z.boolean().optional(),
  prizeSecret: z.boolean().optional(),
  listSize: z.number().int().min(3).max(50).optional(),
})

export const setLeaderboardFlags = adminActionClient
  .schema(flagsSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const rows: { key: string; value: string }[] = []
    if (parsedInput.enabled !== undefined) rows.push({ key: 'leaderboard_enabled', value: String(parsedInput.enabled) })
    if (parsedInput.prizeSecret !== undefined) rows.push({ key: 'leaderboard_prize_secret', value: String(parsedInput.prizeSecret) })
    if (parsedInput.listSize !== undefined) rows.push({ key: 'leaderboard_list_size', value: String(parsedInput.listSize) })
    if (rows.length) {
      const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' })
      if (error) throw new Error('Impossible de mettre à jour les paramètres du classement.')
    }
    revalidatePath('/admin/settings/leaderboard')
    return { success: true }
  })

const categorySchema = z.object({
  category: z.enum(['visits', 'hours', 'spend']),
  enabled: z.boolean(),
  label: z.string().min(1).max(40),
  emoji: z.string().min(1).max(8),
  points_1: z.number().int().min(0).max(100000),
  points_2: z.number().int().min(0).max(100000),
  points_3: z.number().int().min(0).max(100000),
})

export const updateLeaderboardCategory = adminActionClient
  .schema(categorySchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient()
    const { category, ...fields } = parsedInput
    const { error } = await supabase
      .from('leaderboard_config')
      .update(fields)
      .eq('category', category)
    if (error) throw new Error('Impossible de mettre à jour la catégorie.')
    revalidatePath('/admin/settings/leaderboard')
    return { success: true }
  })
```

- [ ] **Step 2: Write the admin page (RSC)**

Create `apps/web/src/app/admin/settings/leaderboard/page.tsx`:

```tsx
import { getLeaderboardSettings, getLeaderboardConfig } from '@/data/student/leaderboard'
import { LeaderboardSettingsCards } from './LeaderboardSettingsCards'

export const dynamic = 'force-dynamic'

export default async function AdminLeaderboardSettingsPage() {
  const [settings, config] = await Promise.all([getLeaderboardSettings(), getLeaderboardConfig()])
  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Classement</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configuration du classement mensuel des étudiants et des récompenses.
        </p>
      </div>
      <LeaderboardSettingsCards initialSettings={settings} initialConfig={config} />
    </div>
  )
}
```

- [ ] **Step 3: Write the config cards (client)**

Create `apps/web/src/app/admin/settings/leaderboard/LeaderboardSettingsCards.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { setLeaderboardFlags, updateLeaderboardCategory } from '@/actions/admin/leaderboard-config'
import type { LeaderboardSettings, LeaderboardConfigRow } from '@/data/student/leaderboard'

export function LeaderboardSettingsCards({
  initialSettings,
  initialConfig,
}: {
  initialSettings: LeaderboardSettings
  initialConfig: LeaderboardConfigRow[]
}) {
  const [settings, setSettings] = useState(initialSettings)
  const { execute: execFlags } = useAction(setLeaderboardFlags, {
    onSuccess: () => toast.success('Paramètres mis à jour.'),
    onError: () => toast.error('Erreur lors de la mise à jour.'),
  })

  function patchFlags(patch: Partial<LeaderboardSettings>) {
    const next = { ...settings, ...patch }
    setSettings(next)
    execFlags(patch)
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Général</CardTitle>
          <CardDescription>Activation et affichage du classement.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Classement activé</span>
            <Switch checked={settings.enabled} onCheckedChange={(v) => patchFlags({ enabled: v })} aria-label="Activer le classement" />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-medium">Prix mystère</span>
              <span className="text-xs text-muted-foreground">Masque les points aux étudiants jusqu'à la remise.</span>
            </div>
            <Switch checked={settings.prizeSecret} onCheckedChange={(v) => patchFlags({ prizeSecret: v })} aria-label="Prix mystère" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium">Nombre de rangs affichés</span>
            <Input
              type="number"
              min={3}
              max={50}
              defaultValue={settings.listSize}
              className="w-24"
              onBlur={(e) => {
                const n = parseInt(e.target.value, 10)
                if (!Number.isNaN(n) && n >= 3 && n <= 50) patchFlags({ listSize: n })
              }}
            />
          </div>
        </CardContent>
      </Card>

      {initialConfig.map((cat) => (
        <CategoryCard key={cat.category} initial={cat} />
      ))}
    </div>
  )
}

function CategoryCard({ initial }: { initial: LeaderboardConfigRow }) {
  const [row, setRow] = useState(initial)
  const { execute } = useAction(updateLeaderboardCategory, {
    onSuccess: () => toast.success('Catégorie mise à jour.'),
    onError: () => toast.error('Erreur lors de la mise à jour.'),
  })

  function save(next: LeaderboardConfigRow) {
    setRow(next)
    execute({
      category: next.category,
      enabled: next.enabled,
      label: next.label,
      emoji: next.emoji,
      points_1: next.points_1,
      points_2: next.points_2,
      points_3: next.points_3,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>{row.emoji}</span> {row.label}
        </CardTitle>
        <CardDescription>Catégorie « {row.category} ».</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Activée</span>
          <Switch checked={row.enabled} onCheckedChange={(v) => save({ ...row, enabled: v })} aria-label={`Activer ${row.category}`} />
        </div>
        <div className="flex gap-3">
          <label className="flex flex-col gap-1 flex-1">
            <span className="text-xs text-muted-foreground">Nom affiché</span>
            <Input defaultValue={row.label} onBlur={(e) => e.target.value.trim() && save({ ...row, label: e.target.value.trim() })} />
          </label>
          <label className="flex flex-col gap-1 w-20">
            <span className="text-xs text-muted-foreground">Emoji</span>
            <Input defaultValue={row.emoji} onBlur={(e) => e.target.value.trim() && save({ ...row, emoji: e.target.value.trim() })} />
          </label>
        </div>
        <div className="flex gap-3">
          {([1, 2, 3] as const).map((rank) => {
            const key = `points_${rank}` as 'points_1' | 'points_2' | 'points_3'
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'
            return (
              <label key={rank} className="flex flex-col gap-1 flex-1">
                <span className="text-xs text-muted-foreground">{medal} points</span>
                <Input
                  type="number"
                  min={0}
                  defaultValue={row[key]}
                  onBlur={(e) => {
                    const n = parseInt(e.target.value, 10)
                    if (!Number.isNaN(n) && n >= 0) save({ ...row, [key]: n })
                  }}
                />
              </label>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
```

> Verify `@/components/ui/input` exists (it is used across admin forms). If the project uses a different input path/name, match the existing one.

- [ ] **Step 4: Link from the admin settings index**

In `apps/web/src/app/admin/settings/page.tsx`, add a link/card to the new page, matching the file's existing link style. Minimal addition inside the returned JSX:

```tsx
<Link href="/admin/settings/leaderboard" className="text-sm font-medium underline">
  Configurer le classement mensuel →
</Link>
```
(`Link` is already imported in that file.)

- [ ] **Step 5: Typecheck**

Run:
```bash
cd apps/web && pnpm typecheck
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/actions/admin/leaderboard-config.ts apps/web/src/app/admin/settings/leaderboard apps/web/src/app/admin/settings/page.tsx
git commit -m "feat(web): admin leaderboard configuration page"
```

---

## Task 7: Student dashboard scoreboard UI

**Files:**
- Create: `apps/web/src/app/student/dashboard/LeaderboardCard.tsx`
- Modify: `apps/web/src/app/student/dashboard/page.tsx`

**Interfaces:**
- Consumes: `getLeaderboard`, `getMyLeaderboardRank`, `getLeaderboardSettings`, `getLeaderboardConfig` (Task 4) and their types.
- Produces: `<LeaderboardCard>` (client) rendered from the dashboard RSC with fetched data as props.

- [ ] **Step 1: Write the client component**

Create `apps/web/src/app/student/dashboard/LeaderboardCard.tsx`:

```tsx
'use client'

import { useState } from 'react'
import type {
  LeaderboardRow,
  LeaderboardConfigRow,
  LeaderboardSettings,
  MyRank,
  LeaderboardCategory,
} from '@/data/student/leaderboard'

function formatValue(category: LeaderboardCategory, value: number): string {
  if (category === 'visits') return `${Math.round(value)} visites`
  if (category === 'hours') return `${value.toFixed(1)}h`
  return `${value.toFixed(2)} DT`
}

function initials(name: string | null): string {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
}

export function LeaderboardCard({
  rows,
  myRanks,
  settings,
  config,
}: {
  rows: LeaderboardRow[]
  myRanks: MyRank[]
  settings: LeaderboardSettings
  config: LeaderboardConfigRow[]
}) {
  const enabledCats = config.filter((c) => c.enabled).sort((a, b) => a.sort_order - b.sort_order)
  const [active, setActive] = useState<LeaderboardCategory>(enabledCats[0]?.category ?? 'visits')

  if (!settings.enabled || enabledCats.length === 0) return null

  const activeCfg = enabledCats.find((c) => c.category === active) ?? enabledCats[0]
  const catRows = rows.filter((r) => r.category === active).sort((a, b) => a.rank - b.rank)
  const podium = catRows.filter((r) => r.rank <= 3)
  const rest = catRows.filter((r) => r.rank > 3)
  const mine = myRanks.find((m) => m.category === active)

  // podium display order: 2nd, 1st, 3rd
  const byRank = (n: number) => podium.find((r) => r.rank === n)
  const podiumOrder = [byRank(2), byRank(1), byRank(3)]
  const heights = ['h-16', 'h-24', 'h-12']
  const medals = ['🥈', '🥇', '🥉']

  const prizeLabel = settings.prizeSecret
    ? '🎁 Prix mystère'
    : `Fin du mois : 🥇${activeCfg.points_1} · 🥈${activeCfg.points_2} · 🥉${activeCfg.points_3} pts`

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: 'var(--synapse-cream-100)', borderColor: 'var(--synapse-cream-300)' }}
    >
      <div className="px-5 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--synapse-brown-500)' }}>
          Classement du mois
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{prizeLabel}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-5 pt-3 pb-1 overflow-x-auto">
        {enabledCats.map((c) => (
          <button
            key={c.category}
            onClick={() => setActive(c.category)}
            className="text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap transition-colors"
            style={
              c.category === active
                ? { background: 'var(--synapse-green-500)', color: 'white' }
                : { background: 'white', color: 'var(--synapse-brown-700)' }
            }
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      {/* Podium */}
      {podium.length > 0 ? (
        <div className="flex items-end justify-center gap-3 px-5 pt-4">
          {podiumOrder.map((r, i) =>
            r ? (
              <div key={i} className="flex flex-col items-center gap-1 flex-1 max-w-[33%]">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold bg-white shadow-sm">
                  {initials(r.full_name)}
                </div>
                <span className="text-[11px] font-semibold text-center truncate w-full" title={r.full_name ?? ''}>
                  {r.full_name ?? 'Anonyme'}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                  {formatValue(active, r.value)}
                </span>
                <div
                  className={`${heights[i]} w-full rounded-t-lg flex items-start justify-center pt-1 transition-all`}
                  style={{ background: 'var(--synapse-cream-300)' }}
                >
                  <span className="text-lg">{medals[i]}</span>
                </div>
              </div>
            ) : (
              <div key={i} className="flex-1 max-w-[33%]" />
            )
          )}
        </div>
      ) : (
        <p className="text-xs text-center py-6" style={{ color: 'var(--muted-foreground)' }}>
          Pas encore de classement ce mois-ci.
        </p>
      )}

      {/* Ranks 4+ */}
      {rest.length > 0 && (
        <div className="px-5 pt-4 flex flex-col gap-1.5">
          {rest.map((r) => (
            <div key={r.student_id} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span className="text-xs font-semibold w-5" style={{ color: 'var(--muted-foreground)' }}>#{r.rank}</span>
                <span className="truncate">{r.full_name ?? 'Anonyme'}</span>
              </span>
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{formatValue(active, r.value)}</span>
            </div>
          ))}
        </div>
      )}

      {/* My rank */}
      <div
        className="mt-4 mx-5 mb-4 rounded-lg px-4 py-2.5 flex items-center justify-between"
        style={{ background: 'var(--synapse-green-50)', color: 'var(--synapse-green-500)' }}
      >
        <span className="text-xs font-semibold">Votre position</span>
        <span className="text-sm font-bold">
          {mine && mine.rank ? `#${mine.rank} · ${formatValue(active, mine.value)}` : 'Non classé'}
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Render it from the dashboard**

In `apps/web/src/app/student/dashboard/page.tsx`:

Add imports at the top:
```tsx
import { getLeaderboard, getMyLeaderboardRank, getLeaderboardSettings, getLeaderboardConfig } from '@/data/student/leaderboard'
import { LeaderboardCard } from './LeaderboardCard'
```

Extend the existing `Promise.all` in the component to also fetch the four leaderboard sources, e.g. add them to the array:
```tsx
const [profile, activeSubscription, presence, importantNotifications, lbRows, lbMyRanks, lbSettings, lbConfig] =
  await Promise.all([
    getMyProfile(),
    getMyActiveSubscription(),
    getMyPresence(),
    getMyImportantNotifications(),
    getLeaderboard(),
    getMyLeaderboardRank(),
    getLeaderboardSettings(),
    getLeaderboardConfig(),
  ])
```

Render the card inside the returned `<div className="space-y-4">`, after the subscription card block (before the closing `</div>`):
```tsx
<LeaderboardCard rows={lbRows} myRanks={lbMyRanks} settings={lbSettings} config={lbConfig} />
```

- [ ] **Step 3: Typecheck + lint**

Run:
```bash
cd apps/web && pnpm typecheck && pnpm lint
```
Expected: PASS.

- [ ] **Step 4: Manual verification in the running app**

Run:
```bash
pnpm --filter web dev
```
Then, with local Supabase seeded (use the fixture inserts from Task 2 committed to real rows or seed via the check-in flow):
- Open `/student/dashboard` on a mobile viewport (DevTools device toolbar). Confirm the card renders, tabs switch categories, podium shows top 3, list shows ranks 4+, "Votre position" reflects the logged-in student.
- Toggle "Prix mystère" in `/admin/settings/leaderboard` → confirm the student card shows "🎁 Prix mystère".
- Disable a category → confirm its tab disappears.
- Turn master switch off → confirm the whole card disappears.
- In `/student/settings`, turn off "Apparaître dans le classement" → confirm the student no longer appears on the board.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/student/dashboard/LeaderboardCard.tsx apps/web/src/app/student/dashboard/page.tsx
git commit -m "feat(web): student dashboard monthly scoreboard UI"
```

---

## Self-Review Notes

- **Spec coverage:** opt-out (T1/T5), config table + all params (T1/T6), settings flags incl. secret prize (T1/T6/T7), awards + idempotent cron (T3), ranking RPCs incl. my-rank (T2), data layer (T4), student podium UI + tabs + list + my-rank + prize hint (T7), admin config UI (T6). Calendar-month window fixed in RPC/cron. All spec sections mapped.
- **Reason column:** spec's stored descriptive reason string replaced by enum `'leaderboard'` + `ref_id` → `leaderboard_awards` (documented in Global Constraints), because `loyalty_ledger.reason` is a CHECK enum with no free-text column.
- **Type consistency:** `LeaderboardCategory`, `LeaderboardRow`, `MyRank`, `LeaderboardConfigRow`, `LeaderboardSettings`, `getLeaderboard`, `getMyLeaderboardRank`, `getLeaderboardSettings`, `getLeaderboardConfig`, `setLeaderboardOptOut`, `setLeaderboardFlags`, `updateLeaderboardCategory` used identically across tasks.
```
