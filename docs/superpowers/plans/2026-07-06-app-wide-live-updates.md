# App-Wide Live Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every prop-driven list/surface in the app refreshes itself when its underlying data changes — no manual page refresh. Immediate fix for the employee seat-swap accept/decline list.

**Architecture:** Two reusable client hooks over Supabase `postgres_changes`. `useLiveRows` maintains a flat list's state from realtime payloads (INSERT/UPDATE/DELETE) with no refetch. `useLiveRefetch` (plus a `<LiveRefresher>` wrapper) subscribes to tables and re-runs a fetcher or `router.refresh()` (debounced) for joined/aggregated surfaces that a raw payload can't reconstruct. A migration adds the missing tables to the `supabase_realtime` publication with `REPLICA IDENTITY FULL`.

**Tech Stack:** Next.js App Router (server + client components), Supabase realtime (`@supabase/supabase-js`), SQL migrations.

## Global Constraints

- Realtime requires the table be in the `supabase_realtime` publication AND have `REPLICA IDENTITY FULL` (so UPDATE/DELETE payloads carry old values for filtering). Already done: `reservations`, `seats`, `tables`, `notifications`.
- Client Supabase instance: `import { createClient } from '@/supabase-clients/client'` (see `LiveSeatMap.tsx`).
- Channel names MUST be unique per mount to avoid collisions: suffix with a random id (`Math.random().toString(36).slice(2,7)`).
- Always `removeChannel` in the effect cleanup.
- Do NOT modify existing bespoke subscribers: `LiveSeatMap.tsx`, notification components. They are already live.
- Follow existing file/style conventions in each surface (many use inline styles, not Tailwind).

---

### Task 1: `useLiveRows` hook (flat lists)

**Files:**
- Create: `apps/web/src/hooks/use-live-rows.ts`

**Interfaces:**
- Produces:
  ```ts
  function useLiveRows<T extends { [k: string]: unknown }>(opts: {
    table: string
    filter?: string
    initial: T[]
    primaryKey?: string   // default 'id'
  }): T[]
  ```

- [ ] **Step 1: Write the hook**

```ts
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/supabase-clients/client'

export function useLiveRows<T extends Record<string, unknown>>(opts: {
  table: string
  filter?: string
  initial: T[]
  primaryKey?: string
}): T[] {
  const { table, filter, initial, primaryKey = 'id' } = opts
  const [rows, setRows] = useState<T[]>(initial)

  // Re-sync when the server sends new initial data (e.g. after navigation).
  useEffect(() => { setRows(initial) }, [initial])

  useEffect(() => {
    const supabase = createClient()
    const uid = Math.random().toString(36).slice(2, 7)
    const channel = supabase
      .channel(`live-rows:${table}:${filter ?? 'all'}:${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) },
        (payload) => {
          setRows((prev) => {
            if (payload.eventType === 'INSERT') {
              const row = payload.new as T
              if (prev.some((r) => r[primaryKey] === row[primaryKey])) return prev
              return [...prev, row]
            }
            if (payload.eventType === 'UPDATE') {
              const row = payload.new as T
              return prev.map((r) => (r[primaryKey] === row[primaryKey] ? row : r))
            }
            // DELETE
            const old = payload.old as T
            return prev.filter((r) => r[primaryKey] !== old[primaryKey])
          })
        },
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [table, filter, primaryKey])

  return rows
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: no errors in `use-live-rows.ts`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/use-live-rows.ts
git commit -m "feat: add useLiveRows realtime hook for flat lists"
```

---

### Task 2: `useLiveRefetch` hook + `LiveRefresher` wrapper (joined/aggregated surfaces)

**Files:**
- Create: `apps/web/src/hooks/use-live-refetch.ts`
- Create: `apps/web/src/components/live/LiveRefresher.tsx`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces:
  ```ts
  function useLiveRefetch(tables: string[], onChange: () => void, opts?: { debounceMs?: number }): void
  ```
  and a component `<LiveRefresher tables={string[]} />` that calls `router.refresh()` on change.

- [ ] **Step 1: Write the hook**

```ts
'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/supabase-clients/client'

export function useLiveRefetch(
  tables: string[],
  onChange: () => void,
  opts?: { debounceMs?: number },
): void {
  const debounceMs = opts?.debounceMs ?? 250
  const cbRef = useRef(onChange)
  cbRef.current = onChange
  const key = tables.join(',')

  useEffect(() => {
    const supabase = createClient()
    const uid = Math.random().toString(36).slice(2, 7)
    let timer: ReturnType<typeof setTimeout> | null = null

    const fire = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => cbRef.current(), debounceMs)
    }

    const channels = tables.map((table) =>
      supabase
        .channel(`live-refetch:${table}:${uid}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, fire)
        .subscribe(),
    )

    return () => {
      if (timer) clearTimeout(timer)
      channels.forEach((c) => void supabase.removeChannel(c))
    }
  }, [key, debounceMs])
}
```

- [ ] **Step 2: Write the `LiveRefresher` wrapper**

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useLiveRefetch } from '@/hooks/use-live-refetch'

/**
 * Drop into any server-component page to make it live: re-runs the server
 * render (router.refresh) whenever any listed table changes. Renders nothing.
 */
export function LiveRefresher({ tables }: { tables: string[] }) {
  const router = useRouter()
  useLiveRefetch(tables, () => router.refresh())
  return null
}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/use-live-refetch.ts apps/web/src/components/live/LiveRefresher.tsx
git commit -m "feat: add useLiveRefetch hook and LiveRefresher wrapper"
```

---

### Task 3: Extend the realtime publication to all live-surface tables

**Files:**
- Create: `apps/database/supabase/migrations/20260706130000_realtime_publication_expand.sql`

**Interfaces:**
- Produces: additional tables in `supabase_realtime` with `REPLICA IDENTITY FULL`, so the hooks receive their changes.

- [ ] **Step 1: Confirm exact table names**

Run: `ls apps/database/supabase/migrations/ | grep -iE 'swap|attendance|subscription|purchase|expense|loyal|reward|announc|shift|profile'`
Then open the relevant `CREATE TABLE` migrations to confirm the exact public table names for: seat swap requests, attendance, subscriptions, purchases, expenses, loyalty/reward requests + ledger, announcements, shifts, profiles, settings.

- [ ] **Step 2: Write the migration**

Use a guarded DO block so re-adding an already-published table is safe. Replace the `tbls` array with the confirmed names from Step 1.

```sql
-- apps/database/supabase/migrations/20260706130000_realtime_publication_expand.sql

DO $$
DECLARE
  t text;
  tbls text[] := ARRAY[
    'seat_swap_requests',
    'attendance',
    'subscriptions',
    'purchases',
    'expenses',
    'announcements',
    'shifts',
    'profiles',
    'settings'
    -- add confirmed loyalty/reward table names here
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    -- REPLICA IDENTITY FULL: UPDATE/DELETE payloads include old row values.
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    -- Add to publication only if not already a member.
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
```

- [ ] **Step 3: Commit**

```bash
git add apps/database/supabase/migrations/20260706130000_realtime_publication_expand.sql
git commit -m "feat(db): add live-surface tables to realtime publication"
```

---

### Task 4: Make the employee rooms page live (the reported bug)

**Files:**
- Modify: `apps/web/src/app/employee/rooms/page.tsx`

**Interfaces:**
- Consumes: `<LiveRefresher>` from Task 2.

The page is a `force-dynamic` server component. `router.refresh()` re-runs it, updating both the swap-request list and the occupancy counts. `SwapRequests` keeps its optimistic `hidden` state; the refresh reconciles it.

- [ ] **Step 1: Import and mount `LiveRefresher`**

Add the import at the top of `apps/web/src/app/employee/rooms/page.tsx`:

```tsx
import { LiveRefresher } from '@/components/live/LiveRefresher'
```

Add the component as the first child inside the returned root `<div>` (before the `<div>` holding the `<h1>`):

```tsx
      <LiveRefresher tables={['seat_swap_requests', 'attendance', 'seats']} />
```

- [ ] **Step 2: Manual verification**

Open the employee rooms page in one tab. In another context (student app / kiosk), submit a seat-swap request. Expected: the swap-request card appears in the employee tab within ~1s with no manual refresh. Accepting/denying it, or the student cancelling, also reflects live.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/employee/rooms/page.tsx
git commit -m "feat: live-update employee rooms page (swap requests + occupancy)"
```

---

### Task 5: Convert remaining employee surfaces (P1)

For each surface below: if it is a server-component page, mount `<LiveRefresher tables={[...]} />` inside it (like Task 4). If it is a client component holding a flat list that maps 1:1 to a single table, replace the static prop with `useLiveRows({ table, filter, initial })`. Choose per the surface's data shape.

**Files & wiring (one commit per surface):**

- `apps/web/src/app/employee/reservations/page.tsx` + `ReservationsClient.tsx` — tables `['reservations','seats']`. Reservations list shows joined seat/student data → mount `<LiveRefresher>` in the page.
- `apps/web/src/app/employee/loyalty-requests/page.tsx` — tables = the loyalty-request table (confirm name) → `<LiveRefresher>`.
- `apps/web/src/app/employee/announcements/page.tsx` + `AnnouncementsClient.tsx` — `announcements`. If the client list maps 1:1, use `useLiveRows({ table: 'announcements', initial })`; else `<LiveRefresher tables={['announcements']} />`.
- `apps/web/src/app/employee/dashboard/page.tsx` — aggregated stats → `<LiveRefresher tables={['attendance','seats','purchases']} />`.
- `apps/web/src/app/employee/students/LookupClient.tsx` — already has a realtime channel; verify it covers the displayed data, extend only if a displayed field is stale (skip if adequate).

- [ ] **Step 1:** For each surface, apply the wiring above, following Task 4's pattern for pages and the `useLiveRows` signature (Task 1) for flat client lists.
- [ ] **Step 2:** Manual two-context check per surface: mutate the backing data elsewhere, confirm the surface updates without manual refresh.
- [ ] **Step 3:** Commit per surface, e.g. `git commit -m "feat: live-update employee reservations page"`.

---

### Task 6: Convert student surfaces (P2)

Same rule (page → `<LiveRefresher>`, flat client list → `useLiveRows`). One commit per surface.

- `apps/web/src/app/student/dashboard/page.tsx` + `PresenceBanner.tsx` — `['attendance','reservations','seats']` → `<LiveRefresher>`.
- `apps/web/src/app/student/reservation/page.tsx` — `['reservations','seats']` → `<LiveRefresher>`.
- `apps/web/src/app/student/rooms/page.tsx` — `['rooms','seats']` → `<LiveRefresher>`.
- `apps/web/src/app/student/rewards/` (`RewardsPanel/HistoryPanel/LeaderboardPanel`) — reward/loyalty tables (confirm names) → `<LiveRefresher>` in the page; leaderboard `['profiles']` or the score source.
- `apps/web/src/app/student/history/StudentHistoryClient.tsx` — `attendance` filtered by `student_id` → `useLiveRows({ table:'attendance', filter:\`student_id=eq.${studentId}\`, initial })` if flat, else `<LiveRefresher>`.
- `apps/web/src/app/student/loyalty/page.tsx` — loyalty tables → `<LiveRefresher>`.

- [ ] **Step 1:** Apply wiring per surface. **Step 2:** Two-context manual check. **Step 3:** Commit per surface.

---

### Task 7: Convert admin surfaces (P3)

Same rule. One commit per surface.

- `apps/web/src/app/admin/dashboard/page.tsx` — has `live-indicators` already; add `<LiveRefresher>` only for any still-static cards (`['attendance','purchases','subscriptions','reservations']`).
- `apps/web/src/app/admin/students/page.tsx` — `['profiles','subscriptions']` → `<LiveRefresher>`.
- `apps/web/src/app/admin/products/page.tsx` + `products-table.tsx` — `products` → `useLiveRows` if flat, else `<LiveRefresher>`.
- `apps/web/src/app/admin/subscription-plans/page.tsx` — `subscription_plans` (confirm) → `useLiveRows`/`<LiveRefresher>`.
- `apps/web/src/app/admin/accounting/page.tsx` — `['purchases','expenses']` → `<LiveRefresher>`.
- `apps/web/src/app/admin/loyalty/page.tsx` — loyalty tables → `<LiveRefresher>`.

- [ ] **Step 1:** Apply wiring per surface. **Step 2:** Two-context manual check. **Step 3:** Commit per surface.

---

## Self-Review

- **Spec coverage:** Two primitives (Tasks 1–2), publication migration (Task 3), swap-request bug (Task 4), employee/student/admin rollout (Tasks 5–7). Bespoke subscribers explicitly untouched. Covered.
- **Placeholder scan:** Hooks + wrapper + migration + bug fix are full code. Tasks 5–7 are mechanical applications of the two documented primitives — table/filter named per surface; exact table-name confirmation is an explicit step (Task 3 Step 1) since names must come from the schema, not be invented.
- **Type consistency:** `useLiveRows` generic `T extends Record<string, unknown>`, keyed by `primaryKey`. `useLiveRefetch(tables, onChange, opts)` used by `LiveRefresher` with `router.refresh`. Signatures consistent across tasks.
