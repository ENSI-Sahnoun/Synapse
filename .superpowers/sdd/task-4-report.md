# Task 4: Realtime seat status sync on reservation page — Report

## Status
✅ DONE

## Changes Implemented

**File:** `apps/web/src/app/student/reservation/ReservationSeatMap.tsx`

### Step 1: Realtime Subscription Added
- Imported `useEffect` from React (added to existing `useState` import)
- Imported `createClient` from `@/supabase-clients/client`
- Added `liveRooms` state initialized from the `rooms` prop
- Implemented Realtime subscription in `useEffect`:
  - Subscribes to `seats` table UPDATE events
  - On event, patches matching seat status across all rooms in `liveRooms` state
  - If pending seat becomes unavailable (`status !== 'free'`), clears the confirmation dialog
  - Cleanup: removes channel on unmount using `void supabase.removeChannel(channel)`
- Replaced all `rooms` references in JSX with `liveRooms`

### Step 2: Verification
- ✅ `pnpm typecheck` passed (exit 0)
- No TypeScript errors
- Changes follow the provided corrections to the brief

## Commits
- `abab308` — feat(student): realtime seat status sync on reservation map

## Tests
- TypeScript typecheck: **PASS**

## Concerns
None. Implementation follows the specification and corrections provided.

---

## Fix 4b — Code Review Fixes

### Fix 1 (Critical): Regenerate database.types.ts
- Ran `supabase db reset --local` then `supabase gen types typescript --local` to get correct types
- Confirmed `reserved_at` (not `created_at`) and `queue_position` present in generated types
- Copied to `apps/web/src/lib/database.types.ts`

### Fix 2 (Important): Add reservations to Realtime publication
- Created `apps/database/supabase/migrations/20260625000002_reservations_realtime.sql`
- Migration: `ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;`
- Applied via `supabase db reset --local`

### Fix 3 (Important): Seat status guard in checkin action
- In `apps/web/src/actions/checkin/checkin-action.ts`
- Added `.eq('status', 'reserved')` guard to seat update on reservation fulfillment
- Prevents overwriting a seat that's already been moved to another status

### Fix 4 (Important): Remove double Realtime subscription
- In `apps/web/src/app/student/reservation/ReservationSeatMap.tsx`
- Removed `liveRooms` state and `setLiveRooms` call from Realtime handler
- LiveSeatMap now manages its own display state internally
- Page-level handler only clears `pendingSeat` if its seat goes non-free
- Replaced `liveRooms.map(...)` with `rooms.map(...)` in JSX

### Verification
- `pnpm typecheck`: PASS (exit 0)
- `pnpm --filter web test -- --testPathPattern=checkin`: 43/43 PASS
