# Student Gamification Scoreboard — Design

**Date:** 2026-07-04
**Status:** Approved, ready for implementation plan

## Goal

A monthly scoreboard on the student dashboard that ranks students across three
categories, shows a podium for the top 3, and awards Synapse (loyalty) points to
winners automatically at month end. Fully admin-configurable, including an option
to keep the prize a secret. Phone-first PWA UI.

Data is already tracked — no new tracking is added. This feature only reads
existing tables and adds config + display + awarding.

## Categories

Calendar-month window: `[first day of month, first day of next month)`.

| key      | Display (default) | Metric                                   | Source               |
| -------- | ----------------- | ---------------------------------------- | -------------------- |
| `visits` | 🔥 Assidus        | count of visits in month                 | `attendance` rows    |
| `hours`  | ⏱️ Marathoniens   | Σ `checked_out_at - checked_in_at` (hrs) | `attendance`         |
| `spend`  | 🛒 Top Clients    | Σ `total_dt`                             | `purchases`          |

Notes:
- `hours` ignores rows where `checked_out_at IS NULL` (open sessions). Midnight
  cron already closes stale sessions.
- `spend` uses `purchases.total_dt`, joined by `student_id`.
- Students who opted out are excluded entirely from ranking (name and rank hidden).

## Privacy

- Full names shown by default.
- Per-student opt-out via a settings toggle. Opted-out students do not appear on
  the board and are not eligible for awards (their rows are excluded from RPC
  results).

## Database

New migration(s) in `apps/database/supabase/migrations/`. Follow existing
conventions: `SECURITY DEFINER` RPCs granted to `authenticated` (mirror
`20260704100000_analytics_rpcs.sql`); pg_cron job (mirror
`20260623000010_smp_cron_midnight_checkout.sql`).

### 1. `profiles.leaderboard_opt_out`

```sql
ALTER TABLE public.profiles
  ADD COLUMN leaderboard_opt_out boolean NOT NULL DEFAULT false;
```

### 2. `leaderboard_config` table (per-category config, admin-managed)

```sql
CREATE TABLE public.leaderboard_config (
  category    text    PRIMARY KEY CHECK (category IN ('visits','hours','spend')),
  enabled     boolean NOT NULL DEFAULT true,
  label       text    NOT NULL,
  emoji       text    NOT NULL,
  points_1    int     NOT NULL DEFAULT 100 CHECK (points_1 >= 0),
  points_2    int     NOT NULL DEFAULT 50  CHECK (points_2 >= 0),
  points_3    int     NOT NULL DEFAULT 25  CHECK (points_3 >= 0),
  sort_order  int     NOT NULL DEFAULT 0
);
```

Seed three rows (visits/hours/spend) with the default labels/emojis above.

RLS: `SELECT` for any authenticated user; `INSERT/UPDATE/DELETE` admin-only
(mirror `settings` policies in `20260623000005_smp_settings.sql`).

### 3. Global flags → existing `settings` KV table

Seed keys:

| key                        | default | meaning                                             |
| -------------------------- | ------- | --------------------------------------------------- |
| `leaderboard_enabled`      | `true`  | master switch; hides whole dashboard section        |
| `leaderboard_prize_secret` | `false` | when `true`, student UI hides point values          |
| `leaderboard_list_size`    | `10`    | number of ranked rows returned/shown per category   |

### 4. `leaderboard_awards` table (award ledger + idempotency guard)

```sql
CREATE TABLE public.leaderboard_awards (
  id         uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  month      date        NOT NULL,          -- first day of awarded month
  category   text        NOT NULL,
  rank       int         NOT NULL CHECK (rank BETWEEN 1 AND 3),
  student_id uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  points     int         NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (month, category, rank)
);
```

RLS: `SELECT` authenticated; writes admin-only (cron runs as definer/superuser so
it bypasses RLS regardless).

### 5. RPC `get_leaderboard(p_month date)`

`SECURITY DEFINER`, `GRANT EXECUTE ... TO authenticated`. Returns top
`leaderboard_list_size` per **enabled** category over `[p_month, p_month + 1 month)`.

Returns table:

```
category    text
label       text
emoji       text
rank        int
student_id  uuid
full_name   text
value       numeric   -- visits: count; hours: hours (numeric); spend: total_dt
```

- Excludes `leaderboard_opt_out = true` students.
- Ranks with `rank() OVER (PARTITION BY category ORDER BY value DESC)`.
- Skips categories where `enabled = false`.

### 6. RPC `get_my_leaderboard_rank(p_month date)`

`SECURITY DEFINER`, granted to `authenticated`. Returns the calling user's rank +
value per enabled category (computed over the full population, not just top N), so
a student outside the top list still sees their standing. Respects opt-out: if the
caller is opted out, returns their metric value but `rank = NULL`.

Returns: `category text, rank int, value numeric`.

### 7. pg_cron `award-monthly-leaderboard`

Schedule `5 0 1 * *` (00:05 on the 1st). A `SECURITY DEFINER` function
`public.award_monthly_leaderboard()`:

1. `v_month := date_trunc('month', now()) - interval '1 month'` (previous month).
2. For each **enabled** category, compute top 3 (excluding opt-outs) via the same
   ranking logic as `get_leaderboard`.
3. For each winner not already in `leaderboard_awards (month, category, rank)`:
   - Insert into `leaderboard_awards` with configured `points_{rank}`.
   - Insert into `loyalty_ledger (student_id, points_delta, reason)` with reason like
     `"🏆 1er {label} — {Month YYYY}"`.
4. `ON CONFLICT (month, category, rank) DO NOTHING` guarantees idempotency (safe to
   re-run).

The `leaderboard_prize_secret` flag does **not** affect awarding — it only controls
display. Points come from `leaderboard_config`.

Verify `loyalty_ledger` accepts the reason value (schema already extended for
`purchase` reason in `20260628100002`; confirm the CHECK/enum, add a value or
migration if the column constrains `reason`).

## Web — data & actions (`apps/web/src`)

- `data/student/leaderboard.ts`
  - `getLeaderboard(month?)` → wraps `get_leaderboard` RPC.
  - `getMyLeaderboardRank(month?)` → wraps `get_my_leaderboard_rank`.
  - `getLeaderboardSettings()` → reads `leaderboard_enabled`, `leaderboard_prize_secret`,
    `leaderboard_list_size` from `settings`, plus config rows for labels/emoji/points.
- `actions/student/leaderboard-optout.ts` → next-safe-action to toggle
  `profiles.leaderboard_opt_out` for the current user.
- `actions/admin/leaderboard-config.ts` → next-safe-action, admin-guarded:
  update `settings` flags and `leaderboard_config` rows.

Follow existing next-safe-action patterns (see `actions/student/*`, `actions/admin/*`).

## Web — Student UI (phone-first PWA)

### Dashboard section
Add `<LeaderboardCard>` on `app/student/dashboard/page.tsx`, below the subscription
card. Hidden entirely when `leaderboard_enabled = false`.

Card (matches existing rounded cream-card styling used on the dashboard):
- **Tab switcher** across enabled categories (emoji + label), ordered by `sort_order`.
- **Podium** for top 3: center-raised 🥇, staggered 🥈🥉; initials/avatar + full name +
  value. Subtle bar-height / entrance animation.
- **Ranked list** for ranks 4…`list_size`.
- **Sticky "Vous — #N" chip** from `get_my_leaderboard_rank`; highlighted if the
  user appears in the visible list. Shows "Non classé" if `rank` is NULL.
- **Prize hint:** per selected category, "Fin du mois : 🥇{p1} · 🥈{p2} · 🥉{p3} pts".
  When `leaderboard_prize_secret = true`, replace with **"🎁 Prix mystère"**.

Value formatting: visits → "N visites"; hours → "Nh" (1 decimal); spend → dinar
formatting consistent with existing POS/accounting display.

### Settings toggle
Add a "Apparaître dans le classement" switch to `StudentSettingsClient.tsx`, wired to
`leaderboard-optout` action.

## Web — Admin UI

New route `app/admin/settings/leaderboard/page.tsx` (+ client cards), styled like
existing `ExamModeCard` / `ReservationHoldCard` / `PriorityThresholdCard`:

- **Master toggle** (`leaderboard_enabled`).
- **Secret prize toggle** (`leaderboard_prize_secret`).
- **List size** input (`leaderboard_list_size`).
- **Per-category card** (visits/hours/spend): enable switch, label input, emoji input,
  three point inputs (🥇🥈🥉).

Add a link to it from the admin settings index (`app/admin/settings/page.tsx`).

## Out of scope (YAGNI)

- Historical past-month browsing on the student side (cron records history in
  `leaderboard_awards`, but no browsing UI now).
- Per-room or per-university leaderboards.
- Configurable window (fixed calendar month) or configurable number of awarded ranks
  (fixed top 3 = the three point fields).
- Manual admin "close month now" trigger (cron handles it; idempotent function can be
  invoked manually via SQL if ever needed).

## Testing

- RPC ranking correctness (ties, opt-out exclusion, disabled categories, empty month).
- `award_monthly_leaderboard` idempotency (re-run inserts nothing; correct points from
  config; only enabled categories).
- Opt-out excludes from board and awards.
- Action guards (admin-only config writes; student can only toggle own opt-out).
- UI: secret-prize hides point values; disabled category hides tab; master-off hides
  section; "Non classé" state.
