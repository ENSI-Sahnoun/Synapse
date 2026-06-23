# Phase 3A: Rooms & Seats DB Migrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create Supabase migrations for `rooms` and `seats` tables with full RLS, indexes, and regenerated TypeScript types.

**Architecture:** Two migration files (rooms then seats, with FK constraint) land in `apps/database/supabase/migrations/` with timestamps starting at `20260623100000`. RLS follows the existing pattern: `current_user_role()` security-definer function (already present from Phase 1A) gates writes to admin/employee; students read all rooms and seats but cannot write. A DB-level trigger maintains `updated_at` on `rooms`.

**Tech Stack:** Supabase (Postgres 15+), pgcrypto, pnpm + Turborepo

## Global Constraints

- Depends on Phase 1A (utilities migration — `set_updated_at()` and `current_user_role()` must exist)
- Migration filenames: `20260623100000` and `20260623100001` — must be newer than Phase 1A timestamps
- RLS enabled on every table — `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- Students can read rooms and seats but cannot INSERT/UPDATE/DELETE any row
- Employees can read and write rooms and seats (status changes, seat moves)
- Admin can do everything including delete
- Cash-only constraint: no payment columns here
- All commands run from `/home/sah/Synapse`

---

### Task 1: Rooms table migration

**Files:**
- Create: `apps/database/supabase/migrations/20260623100000_smp_rooms.sql`

- [ ] **Step 1: Write rooms migration**

```sql
-- apps/database/supabase/migrations/20260623100000_smp_rooms.sql

CREATE TABLE public.rooms (
  id          uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name        text        NOT NULL,
  capacity    int         NOT NULL CHECK (capacity > 0),
  status      text        NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open', 'closed', 'reserved')),
  status_note text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_rooms_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read rooms (students see status for seat map display)
CREATE POLICY "rooms_select" ON public.rooms
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Admin or employee can create rooms
CREATE POLICY "rooms_insert" ON public.rooms
  FOR INSERT WITH CHECK (current_user_role() IN ('admin', 'employee'));

-- Admin or employee can update rooms (rename, change status, set capacity)
CREATE POLICY "rooms_update" ON public.rooms
  FOR UPDATE USING (current_user_role() IN ('admin', 'employee'));

-- Admin only: delete rooms
CREATE POLICY "rooms_delete" ON public.rooms
  FOR DELETE USING (current_user_role() = 'admin');
```

- [ ] **Step 2: Commit**

```bash
git add apps/database/supabase/migrations/20260623100000_smp_rooms.sql
git commit -m "feat(db): add rooms table with RLS"
```

---

### Task 2: Seats table migration

**Files:**
- Create: `apps/database/supabase/migrations/20260623100001_smp_seats.sql`

- [ ] **Step 1: Write seats migration**

```sql
-- apps/database/supabase/migrations/20260623100001_smp_seats.sql

CREATE TABLE public.seats (
  id           uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  room_id      uuid        NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  label        text        NOT NULL,              -- e.g. "A1", "B3"
  position_x   numeric     NOT NULL DEFAULT 0,   -- canvas X set by drag-and-drop editor
  position_y   numeric     NOT NULL DEFAULT 0,   -- canvas Y set by drag-and-drop editor
  status       text        NOT NULL DEFAULT 'free'
                           CHECK (status IN ('free', 'occupied', 'reserved', 'out_of_service')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Index for fast room-based seat lookups (seat map rendering)
CREATE INDEX seats_room_id_idx ON public.seats (room_id);

-- Index for Realtime subscription filtering by room
CREATE INDEX seats_room_id_status_idx ON public.seats (room_id, status);

-- RLS
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read seats
CREATE POLICY "seats_select" ON public.seats
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Admin or employee can create seats (via editor or manual)
CREATE POLICY "seats_insert" ON public.seats
  FOR INSERT WITH CHECK (current_user_role() IN ('admin', 'employee'));

-- Admin or employee can update seats (position, label, status)
CREATE POLICY "seats_update" ON public.seats
  FOR UPDATE USING (current_user_role() IN ('admin', 'employee'));

-- Admin only: delete seats
CREATE POLICY "seats_delete" ON public.seats
  FOR DELETE USING (current_user_role() = 'admin');

-- Enable Realtime on seats so live seat map subscriptions fire
ALTER PUBLICATION supabase_realtime ADD TABLE public.seats;
```

- [ ] **Step 2: Commit**

```bash
git add apps/database/supabase/migrations/20260623100001_smp_seats.sql
git commit -m "feat(db): add seats table with RLS and Realtime publication"
```

---

### Task 3: Apply migrations and regenerate types

**Files:**
- Modify: `apps/web/src/lib/database.types.ts` (regenerated, not hand-edited)

- [ ] **Step 1: Confirm local Supabase is running**

```bash
cd /home/sah/Synapse && pnpm database#status
```

Expected output: services show `running` for `API URL`, `DB URL`, `Studio URL`.

- [ ] **Step 2: Apply all migrations**

```bash
cd /home/sah/Synapse/apps/database && pnpm supabase db reset
```

Expected: output ends with `Finished supabase db reset`. Migrations applied in timestamp order including the two new Phase 3A files.

- [ ] **Step 3: Verify tables exist**

```bash
cd /home/sah/Synapse/apps/database && pnpm supabase db diff --use-migra
```

Expected: empty diff (schema matches migration files exactly).

- [ ] **Step 4: Regenerate TypeScript types**

```bash
cd /home/sah/Synapse && pnpm gen-types-local
```

Expected: `apps/web/src/lib/database.types.ts` updated. Open the file and verify it contains:
- `rooms` row type with `id`, `name`, `capacity`, `status`, `status_note`, `created_at`, `updated_at`
- `seats` row type with `id`, `room_id`, `label`, `position_x`, `position_y`, `status`, `created_at`

- [ ] **Step 5: Commit regenerated types**

```bash
git add apps/web/src/lib/database.types.ts
git commit -m "feat(db): regenerate types after Phase 3A migrations (rooms + seats)"
```

---

## Self-Review

| Spec requirement | Covered |
|---|---|
| `rooms` table with `id, name, capacity, status ('open'\|'closed'\|'reserved'), status_note, created_at, updated_at` | ✅ Task 1 |
| `seats` table with `id, room_id FK, label, position_x, position_y, status ('free'\|'occupied'\|'reserved'\|'out_of_service'), created_at` | ✅ Task 2 |
| RLS: students read-only, employees read+write, admin full | ✅ Tasks 1 + 2 |
| Supabase Realtime enabled on `seats` | ✅ Task 2 Step 1 |
| `updated_at` trigger on `rooms` | ✅ Task 1 |
| `ON DELETE CASCADE` on `seats.room_id` | ✅ Task 2 |
| Indexes for seat map queries and Realtime filtering | ✅ Task 2 |
| TypeScript types regenerated | ✅ Task 3 |
