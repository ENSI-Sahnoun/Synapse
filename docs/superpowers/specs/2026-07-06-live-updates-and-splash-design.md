# App-Wide Live Updates + Student Splash / Preload

Two independent features bundled into one project.

- **A. Live updates everywhere** — every prop-driven list refreshes itself when the
  underlying data changes, no manual page refresh. Fixes the reported pain point:
  the employee seat-swap accept/decline list not updating live.
- **B. Student splash / preload** — a short branded wordmark animation on cold app
  open that warms (prefetches) the main student routes so first navigation is instant.

---

## Feature A — Live updates everywhere

### Current state

- Live pattern already exists: a client component opens a Supabase channel on
  `postgres_changes` and mutates local state (see `LiveSeatMap.tsx`,
  notification components).
- Prop-driven pages that receive server-fetched data and never re-subscribe are
  **stale until manual refresh** — e.g. `apps/web/src/app/employee/rooms/SwapRequests.tsx`.
- Realtime publication currently includes only: `reservations`, `seats`, `tables`,
  `notifications` (all `REPLICA IDENTITY FULL`).

### Design — two reusable primitives

Most lists fall into one of two shapes. Provide one hook for each; each surface
picks the fitting one.

**1. `useLiveRows<T>` — flat lists (1:1 with a single table)**

`apps/web/src/hooks/use-live-rows.ts`

```ts
useLiveRows<T>({
  table: string,
  filter?: string,          // e.g. `room_id=eq.${roomId}`
  initial: T[],
  primaryKey?: string,      // default 'id'
}): T[]
```

- Subscribes to `postgres_changes` `event: '*'` on `table` with `filter`.
- INSERT → append (dedup by pk); UPDATE → replace matching row; DELETE → remove.
- Unique channel name per mount (`${table}:${filter}:${randomId}`); cleans up on
  unmount.
- No refetch, no server round-trip. Screen edits itself from the payload.

**2. `useLiveRefetch — mixed / joined / aggregated lists`**

`apps/web/src/hooks/use-live-refetch.ts`

```ts
useLiveRefetch(tables: string[], onChange: () => void, opts?: { debounceMs?: number })
```

- Subscribes to `postgres_changes` `event: '*'` on each table in `tables`.
- On any change, calls `onChange` debounced (default 250ms). `onChange` is either a
  client fetcher that re-queries and sets state, or `router.refresh()` for
  server-component data.
- Used when the rendered rows blend columns from tables the payload can't
  reconstruct (joins/aggregates), e.g. swap requests showing student + room names.

Both feel live to the user; the only difference is hand-edit vs. quiet refetch.

### Migration — extend the realtime publication

New migration under `apps/database/supabase/migrations/`. For every table that
backs a live surface and isn't already published, add it to `supabase_realtime`
and set `REPLICA IDENTITY FULL` (so UPDATE/DELETE payloads carry old values for
client-side filtering):

- `seat_swap_requests`
- `attendance`
- `subscriptions`
- `purchases`
- `expenses`
- loyalty / reward tables (confirm exact names during implementation)
- `announcements`
- `shifts`
- `profiles`
- `settings`

Each `ADD TABLE` guarded so re-running is safe (skip if already a publication member).

### Rollout — phased inside this one project

- **P0 — Foundation:** `useLiveRows`, `useLiveRefetch`, publication migration.
- **P1 — Employee** (includes the reported bug):
  `SwapRequests` (→ `useLiveRefetch(['seat_swap_requests'], router.refresh)`),
  `ReservationsClient`, `loyalty-requests`, `announcements`, `dashboard`,
  `students LookupClient`, `pos`.
- **P2 — Student:** `dashboard`/`PresenceBanner`, `reservation`, `rooms`,
  `rewards` panels, `history`, `loyalty`.
- **P3 — Admin:** `dashboard`, `students`, `products`, `subscriptions`,
  `accounting`, `loyalty`.

Existing bespoke subscribers (`LiveSeatMap`, notification components) are left as-is.

Each conversion: pick the hook, pass the table + filter (usually a `room_id`,
`student_id`, or a status filter), replace the static prop with the live value.
Per-surface exact table/filter is finalized while implementing that surface.

### Testing

Per surface, two-tab manual check: mutate a row in one tab (or via another
role/kiosk), confirm the list in the other tab updates without a manual refresh.
Primary acceptance: employee swap-request list updates the instant a student
submits/cancels a swap.

---

## Feature B — Student splash / preload

### Behavior

- `SplashScreen` client component, mounted **only in the student layout**
  (`apps/web/src/app/student/layout.tsx`). Staff and kiosk are unaffected.
- Shows on **every cold app open**. A module-level boolean (module scope survives
  client navigations but resets on a fresh JS context = PWA cold start) gives
  "once per app load" without sessionStorage.
- **App-name wordmark** animation (no image asset). Built with `motion`
  (Framer Motion v12, already a dependency).
- **Min display ~1.5s.** During display, `router.prefetch()` warms the main student
  routes: `/student/dashboard`, `/student/rooms`, `/student/reservation`,
  `/student/rewards`, `/student/loyalty`, `/student/history`, `/student/qr`.
- Hides at `max(minDisplay, prefetch-settled)`; overlay is `fixed inset-0`, fades out.

### Build note

Design/animation of the wordmark to be produced with the **Fable design agent**
(distinctive motion, brand-appropriate). Framer Motion (`motion`) for the animation
primitives.

### Testing

Cold-open the student app: wordmark plays, then main routes navigate instantly
(prefetched). Client-side navigations within a session do not re-trigger the splash.
Staff/kiosk never see it.

---

## Out of scope

- Converting bespoke existing subscribers (seat map, notifications) — already live.
- Live updates for static/config pages (forms, editors) with no changing list data.
- Splash for staff or kiosk surfaces.
