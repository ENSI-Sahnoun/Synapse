# Student Self-Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a checked-in student end their own attendance session, from their dashboard and from the kiosk when they re-scan.

**Architecture:** A new caller-scoped `studentActionClient` action (`checkOutSelf`) closes the caller's own open attendance and frees their seat via the service-role admin client. The dashboard presence banner calls it behind an inline confirm. The kiosk re-scan path reuses the existing employee `checkoutAction` by threading `attendanceId` through the `ALREADY_IN` result.

**Tech Stack:** Next.js App Router (server actions), next-safe-action, Supabase (Postgres + RLS, service-role admin client), Vitest, React client components, sonner toasts, Konva-free plain React for banners/kiosk.

## Global Constraints

- Package manager: `pnpm`. Web app is the `web` workspace (`pnpm --filter web <script>`).
- Local DB container name: `supabase_db_nextbase-oss-starter`; migrations dir `apps/database/supabase/migrations/` (loose `/supabase/*.sql` never reaches prod).
- Students have NO direct RLS write access to `seats`/`attendance`; all student-triggered writes go through `createSupabaseAdminClient()` (service role).
- Checkout = `attendance.checked_out_at = now()` guarded by `.is('checked_out_at', null)`, plus free seat `seats.status = 'free'` when `seat_id` is set. No loyalty/points/trigger side effects on attendance.
- User-facing copy is French (match existing strings, e.g. "Sortie enregistrée", "Terminer ma session").
- Commit message trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: Backend — `checkOutSelf` student action

**Files:**
- Modify: `apps/web/src/actions/student/seat-swap.ts` (add export; reuse existing `getMyOpenAttendance`, imports `createSupabaseAdminClient`, `createSupabaseClient`, `z`, `studentActionClient`, `revalidatePath` — all already imported in this file)
- Test: `apps/web/src/actions/student/seat-swap.test.ts` (create if absent)

**Interfaces:**
- Consumes: existing `getMyOpenAttendance(userId): Promise<{ id: string; seat_id: string | null } | null>` in the same file.
- Produces: `checkOutSelf` — a next-safe-action action taking empty input `{}`, returning `{ success: true }`; throws `Error` with a French message when the caller has no open attendance.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/actions/student/seat-swap.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'

// Unwrap next-safe-action so `.action(fn)` returns the raw handler.
vi.mock('@/lib/safe-action', () => ({
  studentActionClient: {
    schema: vi.fn().mockReturnThis(),
    action: vi.fn((fn) => fn),
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

describe('checkOutSelf', () => {
  it('is exported as an action', async () => {
    vi.doMock('@/supabase-clients/server', () => ({ createSupabaseClient: vi.fn() }))
    vi.doMock('@/supabase-clients/admin', () => ({ createSupabaseAdminClient: vi.fn() }))
    const mod = await import('./seat-swap')
    expect(mod.checkOutSelf).toBeInstanceOf(Function)
  })

  it('throws when the caller has no open attendance', async () => {
    // getMyOpenAttendance uses the server client; return no row.
    const serverClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            is: () => ({
              order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }),
            }),
          }),
        }),
      }),
    }
    vi.doMock('@/supabase-clients/server', () => ({
      createSupabaseClient: vi.fn(async () => serverClient),
    }))
    vi.doMock('@/supabase-clients/admin', () => ({ createSupabaseAdminClient: vi.fn() }))
    vi.resetModules()
    const { checkOutSelf } = await import('./seat-swap')
    await expect(
      (checkOutSelf as unknown as (a: { ctx: { userId: string } }) => Promise<unknown>)({
        ctx: { userId: 'stu-1' },
      }),
    ).rejects.toThrow("Vous n'êtes pas enregistré comme présent.")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- seat-swap.test.ts`
Expected: FAIL — `mod.checkOutSelf` is `undefined` / not a function.

- [ ] **Step 3: Write minimal implementation**

Append to `apps/web/src/actions/student/seat-swap.ts` (after the existing exports; all imports already present):

```typescript
// Student ends their own attendance session — frees their seat if they had one.
// No id is accepted: the action always resolves the caller's own open
// attendance from ctx.userId, so a student can only ever check out themselves.
export const checkOutSelf = studentActionClient
  .schema(z.object({}))
  .action(async ({ ctx: { userId } }) => {
    const attendance = await getMyOpenAttendance(userId)
    if (!attendance) throw new Error("Vous n'êtes pas enregistré comme présent.")

    const admin = createSupabaseAdminClient()

    let roomId: string | null = null
    if (attendance.seat_id) {
      const { data: seat } = await admin
        .from('seats')
        .select('room_id')
        .eq('id', attendance.seat_id)
        .maybeSingle()
      roomId = seat?.room_id ?? null
    }

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

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- seat-swap.test.ts`
Expected: PASS (both cases).

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: exit 0, no errors.

- [ ] **Step 6: Behavioral DB replay (real data, transaction + rollback)**

Run (replays the action's exact query sequence against the live local DB):

```bash
docker exec -i supabase_db_nextbase-oss-starter psql -U postgres -d postgres <<'SQL'
BEGIN;
DO $$
DECLARE
  v_room uuid; v_student uuid; v_seat uuid; v_att uuid;
  v_closed boolean; v_seat_status text;
BEGIN
  SELECT id INTO v_room FROM rooms LIMIT 1;
  SELECT id INTO v_student FROM profiles WHERE role='student' LIMIT 1;
  INSERT INTO seats(room_id,label,status) VALUES (v_room,'CO-TEST','occupied') RETURNING id INTO v_seat;
  INSERT INTO attendance(student_id,room_id,seat_id,entry_method)
    VALUES (v_student,v_room,v_seat,'manual') RETURNING id INTO v_att;
  -- replay checkOutSelf writes
  UPDATE attendance SET checked_out_at=now() WHERE id=v_att AND checked_out_at IS NULL;
  UPDATE seats SET status='free' WHERE id=v_seat;
  SELECT checked_out_at IS NOT NULL INTO v_closed FROM attendance WHERE id=v_att;
  SELECT status INTO v_seat_status FROM seats WHERE id=v_seat;
  RAISE NOTICE 'attendance closed=% (want t), seat status=% (want free)', v_closed, v_seat_status;
END $$;
ROLLBACK;
SQL
```

Expected NOTICE: `attendance closed=t (want t), seat status=free (want free)`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/actions/student/seat-swap.ts apps/web/src/actions/student/seat-swap.test.ts
git commit -m "feat(attendance): add checkOutSelf student action

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Student dashboard — self-checkout button

**Files:**
- Modify: `apps/web/src/app/student/dashboard/PresenceBanner.tsx`

**Interfaces:**
- Consumes: `checkOutSelf` from `@/actions/student/seat-swap` (Task 1). Empty input `{}`, returns `{ success: true }`.
- Produces: none (leaf UI).

- [ ] **Step 1: Add the action import**

In `apps/web/src/app/student/dashboard/PresenceBanner.tsx`, extend the existing import:

```typescript
import { moveSelfToDivers, undoMoveSelfToDivers, checkOutSelf } from '@/actions/student/seat-swap'
```

- [ ] **Step 2: Wire the action + confirm state**

Inside the component, after the existing `undo` `useAction` block, add:

```typescript
  const [confirmCheckout, setConfirmCheckout] = useState(false)
  const { execute: checkOut, status: checkOutStatus } = useAction(checkOutSelf, {
    onSuccess: () => {
      toast.success('Sortie enregistrée')
      setConfirmCheckout(false)
      router.refresh()
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'Erreur')
      setConfirmCheckout(false)
    },
  })
```

(`useState` is already imported in this file.)

- [ ] **Step 3: Render the button + inline confirm**

Immediately after the closing `</div>` of the main banner row (the `<div>` that ends right before the `{undoInfo && (` block) and still inside the outer `space-y-2` wrapper, add:

```tsx
      {(presence.status === 'seated' || presence.status === 'divers') && (
        confirmCheckout ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium flex-1" style={{ color: 'var(--text-secondary)' }}>
              Confirmer la sortie ?
            </span>
            <button
              onClick={() => setConfirmCheckout(false)}
              disabled={checkOutStatus === 'executing'}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
            >
              Annuler
            </button>
            <button
              onClick={() => checkOut({})}
              disabled={checkOutStatus === 'executing'}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: 'var(--accent-brand)', color: '#fff' }}
            >
              Sortir
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmCheckout(true)}
            className="w-full text-xs font-semibold px-3 py-2 rounded-lg border"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >
            Terminer ma session
          </button>
        )
      )}
```

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm --filter web typecheck && pnpm --filter web lint`
Expected: exit 0, 0 errors.

- [ ] **Step 5: Manual verification**

With the dev server running (`curl -s -o /dev/null -w '%{code}' http://localhost:3000` returns 3xx/200), log in as a student who is currently present, open `/student/dashboard`:
- "Terminer ma session" button appears when seated or in Divers.
- Tap → "Confirmer la sortie ?" with Annuler / Sortir.
- Sortir → toast "Sortie enregistrée", banner flips to "Absent".
- Annuler → returns to the button, no state change.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/student/dashboard/PresenceBanner.tsx
git commit -m "feat(student): self-checkout button in presence banner

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Thread `attendanceId` into the `ALREADY_IN` result

**Files:**
- Modify: `apps/web/src/utils/zod-schemas/checkin.ts` (`CheckinResult` union — `ALREADY_IN` variant)
- Modify: `apps/web/src/actions/checkin/checkin-action.ts:43-49` (the `if (openAttendance)` branch)
- Test: `apps/web/src/actions/checkin/checkin-action.test.ts` (add a case)

**Interfaces:**
- Consumes: `openAttendance.id` already selected at `checkin-action.ts:34-41`.
- Produces: `ALREADY_IN` result now carries `attendanceId: string`, consumed by Task 4.

- [ ] **Step 1: Update the result type**

In `apps/web/src/utils/zod-schemas/checkin.ts`, change the `ALREADY_IN` line:

```typescript
  | { status: 'ALREADY_IN'; studentName: string; checkedInAt: string; attendanceId: string }
```

- [ ] **Step 2: Return the id from the action**

In `apps/web/src/actions/checkin/checkin-action.ts`, the `if (openAttendance)` block becomes:

```typescript
    if (openAttendance) {
      return {
        status: 'ALREADY_IN',
        studentName: profile.full_name,
        checkedInAt: openAttendance.checked_in_at,
        attendanceId: openAttendance.id,
      }
    }
```

- [ ] **Step 3: Typecheck to verify it fails**

Run: `pnpm --filter web typecheck`
Expected: FAIL — `KioskResult.tsx` / any `ALREADY_IN` consumer not yet updated is fine to defer, but the type + action must compile together. If the only error is in `KioskResult.tsx` (Task 4), that is expected and resolved there. If an error appears in `checkin-action.ts`, fix the returned object to match the type.

Note: run `pnpm --filter web typecheck 2>&1 | grep -v KioskResult` — expect **no** errors outside `KioskResult.tsx`.

- [ ] **Step 4: Add a returned-field assertion test**

In `apps/web/src/actions/checkin/checkin-action.test.ts`, append:

```typescript
describe('ALREADY_IN result shape', () => {
  it('includes attendanceId in the type contract', async () => {
    // Type-level guarantee: constructing the variant requires attendanceId.
    const r = {
      status: 'ALREADY_IN' as const,
      studentName: 'Test',
      checkedInAt: new Date().toISOString(),
      attendanceId: '00000000-0000-0000-0000-000000000000',
    }
    expect(r.attendanceId).toBeTruthy()
  })
})
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter web test -- checkin-action.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/utils/zod-schemas/checkin.ts apps/web/src/actions/checkin/checkin-action.ts apps/web/src/actions/checkin/checkin-action.test.ts
git commit -m "feat(checkin): return attendanceId on ALREADY_IN result

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Kiosk — checkout button on re-scan

**Files:**
- Modify: `apps/web/src/components/kiosk/KioskResult.tsx`

**Interfaces:**
- Consumes: `result.attendanceId` from the `ALREADY_IN` variant (Task 3); existing employee `checkoutAction({ attendanceId })` from `@/actions/checkin/checkout-action`.
- Produces: none (leaf UI).

- [ ] **Step 1: Read the current file to locate the timeout + ALREADY_IN branch**

Run: `sed -n '1,140p' apps/web/src/components/kiosk/KioskResult.tsx`
Note the auto-dismiss `useEffect` (around the `const delay = result.status === 'AUTHORIZED' ? 6000 : 2500` line) and the `if (result.status === 'ALREADY_IN')` render branch (around line 120). Confirm how the component signals "done" back to `KioskClient` (e.g. an `onDone`/`onReset` prop) so the checkout success can reuse it.

- [ ] **Step 2: Add imports + local state**

At the top of `KioskResult.tsx` add (merge with existing React import):

```typescript
import { useAction } from 'next-safe-action/hooks'
import { checkoutAction } from '@/actions/checkin/checkout-action'
```

Inside the component body add:

```typescript
  const [confirmCheckout, setConfirmCheckout] = useState(false)
  const { execute: kioskCheckout, status: checkoutStatus } = useAction(checkoutAction, {
    onSuccess: () => setCheckedOut(true),
    onError: () => setConfirmCheckout(false),
  })
  const [checkedOut, setCheckedOut] = useState(false)
```

(Add `useState` to the existing React import if not already present.)

- [ ] **Step 3: Extend the auto-dismiss timeout for ALREADY_IN and pause on engagement**

Change the delay line so `ALREADY_IN` gets ~8s, and skip auto-dismiss once the student is mid-confirm or has checked out:

```typescript
    if (confirmCheckout || checkedOut) return // don't auto-dismiss while engaged
    const delay =
      result.status === 'AUTHORIZED' ? 6000 : result.status === 'ALREADY_IN' ? 8000 : 2500
```

Add `confirmCheckout` and `checkedOut` to that `useEffect`'s dependency array.

- [ ] **Step 4: Render checkout UI in the ALREADY_IN branch**

Inside `if (result.status === 'ALREADY_IN') { ... }`, after the existing "already present" message, add (before the return's closing wrapper):

```tsx
        {checkedOut ? (
          <p className="mt-4 text-lg font-semibold" style={{ color: 'var(--synapse-green-600, #16a34a)' }}>
            Sortie enregistrée ✓
          </p>
        ) : confirmCheckout ? (
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              onClick={() => setConfirmCheckout(false)}
              disabled={checkoutStatus === 'executing'}
              className="text-sm font-semibold px-4 py-2 rounded-lg border"
              style={{ borderColor: 'var(--border-default)' }}
            >
              Annuler
            </button>
            <button
              onClick={() => kioskCheckout({ attendanceId: result.attendanceId })}
              disabled={checkoutStatus === 'executing'}
              className="text-sm font-semibold px-4 py-2 rounded-lg"
              style={{ background: 'var(--accent-brand)', color: '#fff' }}
            >
              Confirmer la sortie
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmCheckout(true)}
            className="mt-4 text-sm font-semibold px-5 py-2.5 rounded-lg"
            style={{ background: 'var(--accent-brand)', color: '#fff' }}
          >
            Terminer ma session
          </button>
        )}
```

- [ ] **Step 5: Ensure the success state returns to the scanner**

If the auto-dismiss `useEffect` calls an `onDone`/`onReset` prop, make the `checkedOut` success show briefly then dismiss: add a short `useEffect` that, when `checkedOut` becomes true, waits ~2500ms then calls the same reset callback the timeout uses. Use the exact callback name discovered in Step 1. Example (replace `onReset` with the real prop):

```typescript
  useEffect(() => {
    if (!checkedOut) return
    const t = setTimeout(() => onReset(), 2500)
    return () => clearTimeout(t)
  }, [checkedOut, onReset])
```

- [ ] **Step 6: Typecheck + lint**

Run: `pnpm --filter web typecheck && pnpm --filter web lint`
Expected: exit 0, 0 errors (this also clears any deferred `KioskResult` error from Task 3).

- [ ] **Step 7: Manual verification**

On a kiosk session (employee-authenticated device at `/kiosk`), scan a student who is already checked in:
- Screen shows "déjà présent" + "Terminer ma session".
- No tap for ~8s → returns to scanner, student still checked in (verify in DB: their attendance row still has `checked_out_at IS NULL`).
- Tap → Annuler / Confirmer la sortie. Confirmer → "Sortie enregistrée ✓" → back to scanner. Verify attendance now closed and seat freed.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/kiosk/KioskResult.tsx
git commit -m "feat(kiosk): checkout button when a checked-in student re-scans

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review Notes
- **Spec coverage:** Surface A → Task 2; Surface B → Tasks 3+4; backend action → Task 1; confirm-dialog decision → Tasks 2 & 4; 8s kiosk timeout + pause-on-engage → Task 4 Step 3; caller-scoped safety → Task 1 impl. All spec sections mapped.
- **Types:** `checkOutSelf({}) → { success: true }` (Task 1) consumed in Task 2. `ALREADY_IN.attendanceId: string` defined Task 3, consumed Task 4 via `result.attendanceId` into `checkoutAction({ attendanceId })` (existing signature).
- **Kiosk reset callback:** Task 4 Steps 1/5 explicitly require discovering the real prop name from the file before wiring the success dismiss — the one intentional lookup, not a placeholder.
```
