# Phase 4A: Reservations Table Migration + pg_cron Expiry Job

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the `reservations` table with RLS, enforce the one-active-reservation-per-student constraint at the DB level, and install the pg_cron job that expires stale reservations every 5 minutes.

**Architecture:** A single migration file creates the `reservations` table with a partial unique index that prevents two simultaneous active reservations for the same student. A second migration enables the `pg_cron` extension and schedules the expiry sweep; the sweep function sets `reservations.status = 'expired'` and cascades seat status back to `'free'`, which Supabase Realtime will broadcast automatically.

**Tech Stack:** Supabase (Postgres 15+), pg_cron extension, pnpm + Turborepo

## Global Constraints

- Migration filenames start at `20260623200000` — must be newer than all Phase 1–3 files
- RLS enabled on every new table
- `current_user_role()` security-definer function already exists (Phase 1A)
- `seats.status` CHECK constraint: `('free','occupied','reserved','out_of_service')` — already in place from Phase 3
- Cash-only: no payment columns
- French UI labels only in app code — migrations are English
- Run all commands from `/home/sah/Synapse` (repo root)

---

### Task 1: Reservations table migration

**Files:**
- Create: `apps/database/supabase/migrations/20260623200000_reservations_table.sql`

- [ ] **Step 1: Write the migration**

```sql
-- apps/database/supabase/migrations/20260623200000_reservations_table.sql

-- ============================================================
-- RESERVATIONS TABLE
-- ============================================================
CREATE TABLE public.reservations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seat_id       uuid NOT NULL REFERENCES public.seats(id) ON DELETE CASCADE,
  reserved_at   timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  status        text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','expired','fulfilled')),
  queue_position int  -- exam mode only; NULL in normal mode
);

-- ============================================================
-- ONE ACTIVE RESERVATION PER STUDENT — DB-enforced
-- ============================================================
-- Partial unique index: (student_id) must be unique among 'active' rows only.
-- Attempting to INSERT a second active reservation for the same student will
-- raise a unique-violation error (code 23505) that the server action catches.
CREATE UNIQUE INDEX reservations_one_active_per_student
  ON public.reservations (student_id)
  WHERE status = 'active';

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Students can see only their own reservations
CREATE POLICY "student_select_own_reservations"
  ON public.reservations FOR SELECT
  USING (
    student_id = auth.uid()
    OR current_user_role() IN ('admin', 'employee')
  );

-- Only students (with active sub) may INSERT — enforced in server action too
-- RLS insert check: student can only insert a row for themselves
CREATE POLICY "student_insert_own_reservation"
  ON public.reservations FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    AND current_user_role() = 'student'
  );

-- Employees and admins can do anything
CREATE POLICY "staff_all_reservations"
  ON public.reservations FOR ALL
  USING (current_user_role() IN ('admin', 'employee'))
  WITH CHECK (current_user_role() IN ('admin', 'employee'));

-- Service role (pg_cron, server actions) bypasses RLS automatically

-- ============================================================
-- INDEX: fast lookup of active reservation for a student
-- ============================================================
CREATE INDEX reservations_student_active_idx
  ON public.reservations (student_id)
  WHERE status = 'active';

-- ============================================================
-- INDEX: fast lookup of active reservations for a seat
-- ============================================================
CREATE INDEX reservations_seat_active_idx
  ON public.reservations (seat_id)
  WHERE status = 'active';
```

- [ ] **Step 2: Verify migration syntax locally**

```bash
cd /home/sah/Synapse
pnpm supabase db reset --local 2>&1 | tail -20
```

Expected output: no errors; last line contains `Finished supabase db reset`.

- [ ] **Step 3: Commit**

```bash
git add apps/database/supabase/migrations/20260623200000_reservations_table.sql
git commit -m "feat(db): add reservations table with partial unique index and RLS"
```

---

### Task 2: pg_cron expiry job migration

**Files:**
- Create: `apps/database/supabase/migrations/20260623200001_reservations_expiry_cron.sql`

- [ ] **Step 1: Write the migration**

```sql
-- apps/database/supabase/migrations/20260623200001_reservations_expiry_cron.sql

-- ============================================================
-- ENABLE pg_cron (requires Supabase project with pg_cron enabled
-- in Database > Extensions in the dashboard for hosted projects)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Grant pg_cron usage to postgres role (Supabase default)
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- ============================================================
-- EXPIRY FUNCTION
-- Called every 5 minutes by pg_cron.
-- 1. Finds all reservations that are 'active' but past expires_at
-- 2. Sets them to 'expired'
-- 3. Sets the corresponding seat back to 'free'
--    (only if that seat still has status 'reserved' — guards
--     against a fulfilled reservation where seat is 'occupied')
-- Supabase Realtime broadcasts the seats UPDATE automatically.
-- ============================================================
CREATE OR REPLACE FUNCTION public.expire_stale_reservations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_seat_ids uuid[];
BEGIN
  -- 1. Collect seat IDs of stale active reservations
  SELECT ARRAY_AGG(seat_id)
  INTO expired_seat_ids
  FROM public.reservations
  WHERE status = 'active'
    AND expires_at < now();

  -- 2. Expire the reservations
  UPDATE public.reservations
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at < now();

  -- 3. Free the seats (only those still marked 'reserved')
  IF expired_seat_ids IS NOT NULL THEN
    UPDATE public.seats
    SET status = 'free'
    WHERE id = ANY(expired_seat_ids)
      AND status = 'reserved';
  END IF;
END;
$$;

-- ============================================================
-- SCHEDULE: run every 5 minutes
-- Job name is idempotent — unschedule first to allow re-runs
-- of this migration in CI / local reset.
-- ============================================================
SELECT cron.unschedule('expire_stale_reservations') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'expire_stale_reservations'
);

SELECT cron.schedule(
  'expire_stale_reservations',   -- job name
  '*/5 * * * *',                 -- every 5 minutes
  $cron$
    SELECT public.expire_stale_reservations();
  $cron$
);
```

- [ ] **Step 2: Verify pg_cron job is scheduled**

```bash
# After applying migration to local Supabase:
pnpm supabase db reset --local
pnpm supabase db execute --local \
  "SELECT jobname, schedule, command FROM cron.job;"
```

Expected output: one row with `jobname = 'expire_stale_reservations'`, `schedule = '*/5 * * * *'`.

- [ ] **Step 3: Smoke-test the expiry function locally**

```bash
pnpm supabase db execute --local "
  -- Insert a test reservation already past expires_at
  INSERT INTO public.reservations (student_id, seat_id, reserved_at, expires_at, status)
  SELECT
    (SELECT id FROM public.profiles WHERE role = 'student' LIMIT 1),
    (SELECT id FROM public.seats LIMIT 1),
    now() - interval '40 minutes',
    now() - interval '10 minutes',
    'active';

  -- Run expiry
  SELECT public.expire_stale_reservations();

  -- Confirm status changed
  SELECT status FROM public.reservations ORDER BY reserved_at DESC LIMIT 1;
"
```

Expected output: `status = expired`.

- [ ] **Step 4: Commit**

```bash
git add apps/database/supabase/migrations/20260623200001_reservations_expiry_cron.sql
git commit -m "feat(db): add pg_cron expiry job for stale reservations"
```

---

## Self-Review — Spec Coverage

| Spec requirement | Covered |
|---|---|
| `reservations` table with all columns from spec | ✅ Task 1 |
| `status CHECK ('active','expired','fulfilled')` | ✅ Task 1 |
| `queue_position int` (nullable, exam mode only) | ✅ Task 1 |
| Partial unique index: one active reservation per student | ✅ Task 1 |
| RLS: student sees own only; staff sees all | ✅ Task 1 |
| RLS: only student can INSERT for themselves | ✅ Task 1 |
| pg_cron every 5 min → expire → seat → 'free' | ✅ Task 2 |
| Realtime broadcast (automatic from seats UPDATE) | ✅ Task 2 (implicit) |
| `expires_at` computed from `reservation_hold_minutes` | Enforced in server action (Phase 4B) — correct layer |
