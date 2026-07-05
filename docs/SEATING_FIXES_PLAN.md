# Seating System Fixes — Plan (Issues #2 and #3)

Status: **not implemented** — plan only.
Context: audit on 2026-07-05 of the seat-map / attendance / reservation / swap
system. Issue #1 (over-broad `seats_update_status_student` RLS policy) is
tracked separately and intentionally excluded here.

---

## Issue #2 — Editor deletes silently evict live students / kill reservations

### Problem
`deleteSeatAction` and `deleteTableAction`
(`apps/web/src/actions/admin/seat-map.ts`) delete immediately with no status
check and no `confirm()` on the client. FK cascades then fire silently:

- occupied seat → `attendance.seat_id` `SET NULL` (student dropped to "Divers",
  no notification)
- reserved seat → row in `reservations` `CASCADE` deleted (hold lost, no
  notification)
- pending swap whose `to_seat_id` is that seat → `CASCADE` deleted

An admin rearranging the map mid-session destroys live state with zero warning.
This is what orphaned an attendance row and produced the
`seat_swap_requests_from_seat_id_fkey` error.

### Goal
Deleting a seat/table that has live state must be a **deliberate** action, and
affected students must be **notified**. Never silently drop a live occupant or a
reservation.

### Approach

**Server (source of truth — enforce regardless of client):**
1. In `deleteSeatAction`, before deleting, load the seat's `status` plus any
   open attendance and active reservation referencing it.
2. Behavior:
   - If seat is `free` / `out_of_service` with no live refs → delete as today.
   - If seat is `occupied` or `reserved` → require an explicit
     `force: boolean` flag in the schema (`deleteSeatSchema`). Without `force`,
     return a typed error describing what's attached (e.g. "Place occupée par un
     étudiant — confirmez pour libérer"). With `force`:
     - notify the occupant (`insertInAppNotification`, new/existing type — see
       Notifications below) before the delete,
     - notify any active-reservation holder,
     - then delete (cascade cleans the rows).
3. `deleteTableAction`: a table delete only `SET NULL`s `seats.table_id`
   (chairs survive), so it is low-risk. Keep as-is **but** if the table still
   has attached seats that are occupied/reserved, apply the same `force` gate so
   a table delete can't be used to sidestep the seat guard. (Chairs are unlinked,
   not deleted, so no occupant is evicted by a table delete — verify this stays
   true; if confirmed, table delete needs no notification.)

**Client (`EditorCanvas.tsx` `handleDeleteSeat` / `handleDeleteTable`):**
4. Before calling the action, if the target seat's in-memory `status` is
   `occupied` or `reserved`, show a confirm dialog naming the consequence
   ("Cette place est occupée/réservée. La supprimer libèrera l'étudiant. Continuer ?").
   On confirm, call the action with `force: true`.
5. Keep the optimistic local removal, but roll it back in the action's
   `onError` (re-add the seat/table to state) so a rejected force-less delete
   doesn't desync the canvas from the DB.

**Notifications:**
6. Reuse an existing notification type if one fits; otherwise add
   `seat_removed_by_staff` to the `notifications_type_check` constraint via a new
   migration in `apps/database/supabase/migrations/` (follow the existing
   `notifications_type_extend` pattern) and to any client-side type union.

### Files touched
- `apps/web/src/actions/admin/seat-map.ts` (delete actions + status/ref checks + notify)
- `apps/web/src/utils/zod-schemas/table.ts` and `.../seat.ts` (add `force` to delete schemas)
- `apps/web/src/app/admin/rooms/[roomId]/editor/EditorCanvas.tsx` (confirm dialog, force flag, onError rollback)
- (maybe) new migration extending `notifications_type_check`
- `apps/web/src/lib/database.types.ts` — only if a new notification type is added

### Tests / verification
- Delete a `free` seat → succeeds, no prompt.
- Delete an `occupied` seat without force → typed error, seat still present, canvas unchanged.
- Delete an `occupied` seat with force → seat gone, student moved to Divers, student got a notification.
- Delete a `reserved` seat with force → reservation gone, holder notified.
- Confirm no dangling refs afterward:
  `SELECT count(*) FROM attendance a WHERE a.seat_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM seats s WHERE s.id=a.seat_id);` → 0.

### Risks
- Adding `force` to the schema is a breaking change to the action signature —
  update every caller.
- Optimistic-removal rollback must restore the seat's children/links exactly;
  test drag state isn't corrupted.

---

## Issue #3 — Swap accept ignores checkout (phantom occupied seat)

### Problem
`acceptSeatSwapRequest` (`apps/web/src/actions/employee/seat-swap.ts`) loads the
request and the target seat, then marks the target seat `occupied` and writes
`seat_id` onto `attendance_id` — but never checks the attendance is still open.
If the student checked out between requesting and staff accepting, the seat is
marked `occupied` for an absent student → phantom occupied seat that no one can
free normally.

### Goal
Accepting a swap for a student who is no longer checked in must fail cleanly
(and mark the request resolved), never occupy a seat for an absent student.

### Approach
1. After loading `request`, load its `attendance` row (`id, checked_out_at,
   student_id`) with the admin client.
2. Guard before touching seats:
   - attendance missing, or `checked_out_at IS NOT NULL` → do **not** occupy.
     Mark the request `denied`/`cancelled` (`resolved_at`, `resolved_by`),
     notify the student ("demande expirée : vous n'êtes plus enregistré comme
     présent"), and return a typed error to staff
     ("L'étudiant n'est plus présent — demande annulée.").
3. Only if attendance is open, proceed with the existing occupy/rollback flow
   (which is already race-safe via the `.eq('status','free')` guard).
4. Order matters: check attendance **before** the seat `occupied` update so no
   seat is ever transiently occupied for an absent student.

### Files touched
- `apps/web/src/actions/employee/seat-swap.ts` (`acceptSeatSwapRequest` only)

### Tests / verification
- Student checks out, then staff accepts → request resolved as cancelled/denied,
  target seat stays `free`, student notified, staff sees the message.
- Normal path (student still present) → unchanged, swap succeeds.
- Concurrency: two staff accept the same request → second sees "déjà traitée"
  (existing `status !== 'pending'` guard still holds).

### Risks
- Deciding the resolved status for an expired request (`denied` vs `cancelled`).
  Recommend `cancelled` (student-side reason), but confirm which the UI expects.

---

## Suggested order
1. Issue #3 first — single file, self-contained, low blast radius.
2. Issue #2 second — multi-file, schema change, migration, client dialog.

## Not in scope here
- Issue #1 (RLS `seats_update_status_student`) — separate security fix.
- Making `attendance` open-per-student index actually `UNIQUE` (pre-existing,
  unrelated to the editor).
