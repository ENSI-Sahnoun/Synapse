# Student Daily Reservation Limit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cap each student at a configurable maximum number of reservations per calendar day (default 3), counting all reservations except student-cancelled ones.

**Architecture:** A settings-backed limit read at reservation-creation time. A new guard in the `createReservation` server action counts today's non-cancelled reservations for the student and rejects when the count reaches the limit. Enforced in the action only (sole student write path; RLS blocks direct inserts).

**Tech Stack:** Next.js server actions, next-safe-action, Supabase (Postgres), SQL migrations.

## Global Constraints

- Limit source: `settings` table, key `max_reservations_per_day`, seeded to `'3'`. Read with `?? '3'` fallback so absence is safe.
- Count rule: reservations with `reserved_at` today (UTC midnight boundary) AND `status != 'cancelled'`. Statuses `active`, `expired`, `fulfilled`, `confirmed` count; `cancelled` does not.
- Day boundary: reuse the `today` variable already computed as `new Date().toISOString().split('T')[0]` at the top of `createReservation` (UTC midnight).
- Enforcement is action-only. No DB trigger. Do NOT touch the existing `reservations_one_active_per_student` partial unique index.
- User-facing copy is French, matching the existing action.

---

### Task 1: Seed the settings key via migration

**Files:**
- Create: `apps/database/supabase/migrations/20260706120000_max_reservations_per_day_setting.sql`

**Interfaces:**
- Produces: settings row `('max_reservations_per_day', '3')` readable by all authenticated users (existing `settings_select` RLS policy already permits this).

- [ ] **Step 1: Write the migration**

```sql
-- apps/database/supabase/migrations/20260706120000_max_reservations_per_day_setting.sql

-- Daily reservation cap per student. Read by the createReservation server action
-- with a fallback of '3', so this seed is for admin visibility/tuning.
INSERT INTO public.settings (key, value) VALUES
  ('max_reservations_per_day', '3')
ON CONFLICT (key) DO NOTHING;
```

- [ ] **Step 2: Verify the migration file is syntactically consistent with siblings**

Run: `ls apps/database/supabase/migrations/ | grep max_reservations`
Expected: prints `20260706120000_max_reservations_per_day_setting.sql`

- [ ] **Step 3: Commit**

```bash
git add apps/database/supabase/migrations/20260706120000_max_reservations_per_day_setting.sql
git commit -m "feat(db): seed max_reservations_per_day setting"
```

---

### Task 2: Add the daily-limit guard to createReservation

**Files:**
- Modify: `apps/web/src/actions/student/reservations.ts` (insert new guard after the active-reservation check, ~after line 70, before the "3. Verify the seat is currently free" block)

**Interfaces:**
- Consumes: `supabase` client and `userId` (already in scope in the action); `today` variable (already computed at line 20).
- Produces: early `return { error: string }` when the student has reached the daily limit.

- [ ] **Step 1: Add the guard block**

Insert immediately after the "2b. Block if student already has an active reservation" block (after the closing brace of the `if (activeReservation)` block, before the `// 3. Verify the seat is currently free` comment):

```ts
    // 2c. Enforce the per-day reservation limit (default 3).
    // Counts today's reservations that were not student-cancelled.
    const { data: limitRow } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'max_reservations_per_day')
      .maybeSingle()

    const maxPerDay = parseInt(limitRow?.value ?? '3', 10)

    const { count: todayCount } = await supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', userId)
      .gte('reserved_at', today)
      .neq('status', 'cancelled')

    if ((todayCount ?? 0) >= maxPerDay) {
      return {
        error: `Vous avez atteint la limite de ${maxPerDay} réservations par jour.`,
      }
    }
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && pnpm tsc --noEmit` (or the repo's typecheck command — check `apps/web/package.json` scripts)
Expected: no new type errors in `reservations.ts`

- [ ] **Step 3: Manual verification (documented for the reviewer)**

With a test student:
1. Create 3 reservations, letting each expire (or cancel-then-recreate is NOT valid since cancelled don't count — use expiry). 4th create attempt returns the limit error.
2. Cancel one of today's non-cancelled reservations → non-cancelled count drops → a further create succeeds.
3. Confirm the limit message shows the actual configured number.

Expected: 4th blocked with `Vous avez atteint la limite de 3 réservations par jour.`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/actions/student/reservations.ts
git commit -m "feat: enforce daily reservation limit for students"
```

---

## Self-Review

- **Spec coverage:** Count rule (Task 2 guard: `neq('status','cancelled')` + `gte('reserved_at', today)`), settings source (Task 1 seed + Task 2 read with fallback), action-only enforcement (Task 2, no trigger), UTC day boundary (reuses `today`). All covered.
- **Placeholder scan:** None — full SQL and TS provided.
- **Type consistency:** `todayCount` is `number | null` from the count query; guarded with `?? 0`. `maxPerDay` parsed to int with fallback. Consistent.
