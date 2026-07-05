# Student Self-Checkout — Design

Date: 2026-07-06
Status: approved, not yet implemented

## Goal
Let a checked-in student end their own attendance session ("check out")
without staff action, from two surfaces:
- **A. Student dashboard** — a button in their presence banner.
- **B. Kiosk** — when an already-checked-in student re-scans their QR, the
  kiosk offers a checkout button instead of only saying "already present".

Checkout = set `attendance.checked_out_at = now()` and, if the student held a
seat, free it (`seats.status = 'free'`). No loyalty/points/trigger side effects
exist on attendance (verified), so nothing else to touch.

## Decisions (from brainstorming)
- **Confirmation:** every checkout goes through an inline confirm
  ("Confirmer la sortie ?" · Annuler / Sortir). No undo window.
- **Kiosk timeout:** the `ALREADY_IN` result screen auto-dismisses after ~8s
  (longer than the current 2.5s) so there is time to tap. Walking away without
  tapping does NOT check the student out. Engaging the confirm cancels the
  auto-dismiss timer.
- **Scope:** dashboard + kiosk only. The employee manual check-in result
  (`CheckinResult.tsx`, also renders `ALREADY_IN`) is explicitly out of scope
  for now.

---

## Surface A — Student dashboard

File: `apps/web/src/app/student/dashboard/PresenceBanner.tsx`

- Add a "Terminer ma session" button, shown whenever the student is present
  (`presence.status === 'seated' || presence.status === 'divers'`). It sits
  alongside the existing "Passer en Divers" button (which only shows when
  `seated`).
- Interaction: tap → inline confirm (small two-button confirm rendered in the
  banner, reusing the existing local-state pattern in this client component;
  no new dialog dependency). On confirm → execute `checkOutSelf`.
- On success: `toast.success('Sortie enregistrée')` + `router.refresh()` so the
  banner flips to "Absent".
- On error: `toast.error(error.serverError ?? 'Erreur')`.
- Disable the button while the action is executing.

## Surface B — Kiosk re-scan

Files:
- `apps/web/src/utils/zod-schemas/checkin.ts` — add `attendanceId: string` to
  the `ALREADY_IN` variant of `CheckinResult`.
- `apps/web/src/actions/checkin/checkin-action.ts` — in the `openAttendance`
  branch (currently returns `status: 'ALREADY_IN'` with name + `checkedInAt`),
  also return `attendanceId: openAttendance.id`.
- `apps/web/src/components/kiosk/KioskResult.tsx`:
  - In the `ALREADY_IN` branch, render a "Terminer ma session" button + inline
    confirm.
  - Confirm calls the existing employee `checkoutAction({ attendanceId })`
    (kiosk already runs under employee auth — same client `checkinAction` uses).
  - On checkout success: show a brief success state, then return to the scanner.
  - Auto-dismiss timer (`KioskResult.tsx`, currently
    `const delay = result.status === 'AUTHORIZED' ? 6000 : 2500`): give
    `ALREADY_IN` ~8000ms. When the confirm opens, cancel/clear the pending
    auto-dismiss timeout so it cannot fire mid-confirmation.

## Backend — new action

File: `apps/web/src/actions/student/seat-swap.ts`
(co-located with the other student self-service seat actions; reuses the
existing `getMyOpenAttendance(userId)` helper already in this file.)

```
export const checkOutSelf = studentActionClient
  .schema(z.object({}))
  .action(async ({ ctx: { userId } }) => {
    const attendance = await getMyOpenAttendance(userId)   // { id, seat_id } | null
    if (!attendance) throw new Error("Vous n'êtes pas enregistré comme présent.")

    const admin = createSupabaseAdminClient()

    // Read room for revalidation before we mutate.
    let roomId: string | null = null
    if (attendance.seat_id) {
      const { data: seat } = await admin
        .from('seats').select('room_id').eq('id', attendance.seat_id).maybeSingle()
      roomId = seat?.room_id ?? null
    }

    // Close the session (no-op if already closed — guarded by is('checked_out_at', null)).
    const { error } = await admin
      .from('attendance')
      .update({ checked_out_at: new Date().toISOString() })
      .eq('id', attendance.id)
      .is('checked_out_at', null)
    if (error) throw new Error(error.message)

    if (attendance.seat_id) {
      await admin.from('seats').update({ status: 'free' }).eq('id', attendance.seat_id)
    }

    if (roomId) {
      revalidatePath(`/employee/rooms/${roomId}/map`)
      revalidatePath(`/admin/rooms/${roomId}/map`)
    }
    revalidatePath('/employee/rooms')
    return { success: true }
  })
```

Key property: the student passes **no id** — the action always resolves the
caller's own open attendance from `ctx.userId`, so a student can only ever check
out themselves. Uses the service-role admin client for the writes (consistent
with `moveSelfToDivers` in the same file; students have no direct RLS write to
`seats`/`attendance`).

## Data flow & safety
- Double-checkout: the `.is('checked_out_at', null)` filter makes a second
  checkout a silent no-op rather than an error.
- Seat freeing is the identical `status='free'` update the employee
  `checkoutAction` and `moveSelfToDivers` already perform.
- Kiosk path is unchanged auth-wise (employee `checkoutAction`); only adds an
  id to the result payload.
- No triggers on `attendance`; POS checkout function is unrelated (purchases).

## Testing
- **Unit** (`apps/web/src/actions/checkin/checkin-action.test.ts` pattern):
  - `checkOutSelf` with a seated open attendance → attendance closed, seat freed.
  - with a `divers` open attendance (no seat) → attendance closed, no seat write.
  - with no open attendance → throws "Vous n'êtes pas enregistré comme présent."
  - already checked out → no-op (no throw).
- **DB replay** on the live local DB (transaction + rollback, as used for the
  seating fixes): create seated attendance → run the action's query sequence →
  assert `checked_out_at` set and seat `status='free'`.
- **Kiosk**: assert `checkinAction` returns `attendanceId` on `ALREADY_IN`, and
  the type compiles; manual click-through of re-scan → confirm → checkout.

## Files touched (summary)
- `apps/web/src/actions/student/seat-swap.ts` (new `checkOutSelf`)
- `apps/web/src/app/student/dashboard/PresenceBanner.tsx` (button + confirm)
- `apps/web/src/utils/zod-schemas/checkin.ts` (`ALREADY_IN.attendanceId`)
- `apps/web/src/actions/checkin/checkin-action.ts` (return `attendanceId`)
- `apps/web/src/components/kiosk/KioskResult.tsx` (button, confirm, timeout)
- tests

## Out of scope
- Employee manual check-in `ALREADY_IN` checkout button (trivial future add —
  shares the type + `checkoutAction`).
- Any change to check-in, loyalty, or reservation logic.
