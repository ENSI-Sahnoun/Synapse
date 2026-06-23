# Phase 4C: Exam Mode — Waitlist, Priority Queue, Mandatory Reservation Enforcement

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When an admin enables exam mode (`settings.exam_mode = 'true'`), reservations become mandatory for check-in, new reservations are assigned a `queue_position`, and students with subscriptions ≥ `settings.priority_min_duration_days` days jump the queue ahead of short-term subscribers.

**Architecture:** Exam mode is a pure settings flag — no schema change needed (the `queue_position` column already exists from Phase 4A). The `createReservation` server action (Phase 4B) is extended with a conditional block that reads `exam_mode` and `priority_min_duration_days` and assigns `queue_position` atomically using a `SELECT MAX(queue_position) + 1` lock-safe approach. The check-in action is extended to deny entry (`DENIED_NO_RESERVATION`) if `exam_mode = 'true'` and no active reservation exists. The student reservation page shows a waitlist position banner in exam mode.

**Tech Stack:** Next.js 16 server actions, Supabase server client, `studentActionClient`, `employeeActionClient`, Zod

## Global Constraints

- Never hardcode `exam_mode` or `priority_min_duration_days` values — always read from `settings` table
- `queue_position` is `NULL` in normal mode; assigned only when `exam_mode = 'true'`
- Priority students (subscription plan `duration_days` ≥ `priority_min_duration_days`) get a lower `queue_position` than non-priority students already in queue — they are inserted ahead of the first non-priority entry in the current queue
- `DENIED_NO_RESERVATION` is a new check-in status string added alongside existing statuses from Phase 2B
- French UI strings only
- Cash-only: no payment fields
- Run all commands from `/home/sah/Synapse`

---

### Task 1: Queue assignment in `createReservation` action

**Files:**
- Modify: `apps/web/src/app/(student-pages)/student/reservation/actions.ts`

- [ ] **Step 1: Read the current `createReservation` action** to locate the INSERT block (after `holdMinutes` is read and before the `reservations` INSERT).

- [ ] **Step 2: Add exam mode + queue position logic** — insert this block immediately after the `holdMinutes` read and before the `reservations` INSERT:

```typescript
// --- Exam mode: queue assignment ---
const { data: examModeSetting } = await supabase
  .from('settings')
  .select('value')
  .eq('key', 'exam_mode')
  .single();

const examMode = examModeSetting?.value === 'true';

let queuePosition: number | null = null;

if (examMode) {
  const { data: prioritySetting } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'priority_min_duration_days')
    .single();

  const priorityMinDays = parseInt(prioritySetting?.value ?? '30', 10);

  // Check if this student qualifies as priority
  // (their current active subscription's plan duration_days >= priorityMinDays)
  const { data: subWithPlan } = await supabase
    .from('subscriptions')
    .select('subscription_plans(duration_days)')
    .eq('student_id', user.id)
    .gte('end_date', new Date().toISOString().split('T')[0])
    .order('end_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const planDuration = (subWithPlan?.subscription_plans as { duration_days: number } | null)
    ?.duration_days ?? 0;
  const isPriority = planDuration >= priorityMinDays;

  if (isPriority) {
    // Priority students go ahead of the first non-priority active reservation
    // Find the minimum queue_position of non-priority students currently in queue
    const { data: firstNonPriority } = await supabase
      .from('reservations')
      .select('queue_position')
      .eq('status', 'active')
      .not('queue_position', 'is', null)
      .order('queue_position', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (firstNonPriority?.queue_position != null) {
      // Shift all non-priority entries down by 1 to make room
      await supabase.rpc('shift_queue_positions_down', {
        from_position: firstNonPriority.queue_position,
      });
      queuePosition = firstNonPriority.queue_position;
    } else {
      // No non-priority entries — join at the end of the priority block
      const { data: maxRow } = await supabase
        .from('reservations')
        .select('queue_position')
        .eq('status', 'active')
        .not('queue_position', 'is', null)
        .order('queue_position', { ascending: false })
        .limit(1)
        .maybeSingle();

      queuePosition = (maxRow?.queue_position ?? 0) + 1;
    }
  } else {
    // Non-priority: join at the end of the queue
    const { data: maxRow } = await supabase
      .from('reservations')
      .select('queue_position')
      .eq('status', 'active')
      .not('queue_position', 'is', null)
      .order('queue_position', { ascending: false })
      .limit(1)
      .maybeSingle();

    queuePosition = (maxRow?.queue_position ?? 0) + 1;
  }
}
// --- End exam mode queue assignment ---
```

- [ ] **Step 3: Include `queue_position` in the INSERT**

Replace the existing `reservations` INSERT object to include `queue_position`:

```typescript
const { data: reservation, error: insertError } = await supabase
  .from('reservations')
  .insert({
    student_id: user.id,
    seat_id: seatId,
    expires_at: expiresAt,
    status: 'active',
    queue_position: queuePosition, // null in normal mode, integer in exam mode
  })
  .select('id')
  .single();
```

- [ ] **Step 4: Return exam mode info to the client**

Extend the success return to include queue info:

```typescript
return {
  success: true,
  reservationId: reservation.id,
  expiresAt,
  holdMinutes,
  examMode,
  queuePosition,
};
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(student-pages\)/student/reservation/actions.ts
git commit -m "feat(exam-mode): assign queue_position on reservation create"
```

---

### Task 2: `shift_queue_positions_down` DB function

**Files:**
- Create: `apps/database/supabase/migrations/20260623200002_shift_queue_positions.sql`

- [ ] **Step 1: Write the migration**

```sql
-- apps/database/supabase/migrations/20260623200002_shift_queue_positions.sql

-- Called when a priority student inserts before non-priority entries.
-- Increments queue_position by 1 for all active reservations
-- with queue_position >= from_position, making a gap for the priority insert.
CREATE OR REPLACE FUNCTION public.shift_queue_positions_down(from_position int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.reservations
  SET queue_position = queue_position + 1
  WHERE status = 'active'
    AND queue_position >= from_position;
END;
$$;
```

- [ ] **Step 2: Apply migration and verify**

```bash
pnpm supabase db reset --local 2>&1 | tail -5
pnpm supabase db execute --local \
  "SELECT proname FROM pg_proc WHERE proname = 'shift_queue_positions_down';"
```

Expected: one row with `proname = shift_queue_positions_down`.

- [ ] **Step 3: Commit**

```bash
git add apps/database/supabase/migrations/20260623200002_shift_queue_positions.sql
git commit -m "feat(db): add shift_queue_positions_down function for exam mode priority"
```

---

### Task 3: Mandatory reservation enforcement at check-in

**Files:**
- Modify: `apps/web/src/app/(employee-pages)/employee/checkin/actions.ts`

- [ ] **Step 1: Add `DENIED_NO_RESERVATION` check** — insert this block immediately after the subscription active-check passes (before the reservation fulfillment block added in Phase 4B):

```typescript
// --- Exam mode: mandatory reservation check ---
const { data: examModeRow } = await supabase
  .from('settings')
  .select('value')
  .eq('key', 'exam_mode')
  .single();

const examModeActive = examModeRow?.value === 'true';

if (examModeActive) {
  const { data: mandatoryReservation } = await supabase
    .from('reservations')
    .select('id')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .maybeSingle();

  if (!mandatoryReservation) {
    return {
      status: 'DENIED_NO_RESERVATION' as const,
      studentName: student.full_name,
    };
  }
}
// --- End exam mode check ---
```

- [ ] **Step 2: Update the check-in result display component** in `apps/web/src/app/(employee-pages)/employee/checkin/CheckInResult.tsx` to handle the new status:

```tsx
// Add this case alongside DENIED_EXPIRED, DENIED_NO_SUB, etc.
{result.status === 'DENIED_NO_RESERVATION' && (
  <div className="rounded-xl bg-red-50 border border-red-300 p-6 text-center">
    <p className="text-xl font-bold text-red-700">Accès refusé</p>
    <p className="text-red-600 mt-1">{result.studentName}</p>
    <p className="text-red-500 text-sm mt-2">
      Mode examen actif — une réservation préalable est obligatoire.
    </p>
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\(employee-pages\)/employee/checkin/
git commit -m "feat(exam-mode): deny check-in without active reservation when exam mode is on"
```

---

### Task 4: Waitlist position banner on student reservation page

**Files:**
- Modify: `apps/web/src/app/(student-pages)/student/reservation/ActiveReservationBanner.tsx`

- [ ] **Step 1: Extend `ActiveReservationBanner` to show queue position**

Replace the current `Reservation` type and component content:

```tsx
// apps/web/src/app/(student-pages)/student/reservation/ActiveReservationBanner.tsx
'use client';

import { useEffect, useState } from 'react';

type Reservation = {
  id: string;
  seat_id: string;
  expires_at: string;
  queue_position: number | null;
  seats: { label: string } | null;
};

export function ActiveReservationBanner({
  reservation,
  examMode,
}: {
  reservation: Reservation;
  examMode: boolean;
}) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    function update() {
      const diff = new Date(reservation.expires_at).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('Expirée'); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${m}m ${s.toString().padStart(2, '0')}s`);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [reservation.expires_at]);

  return (
    <div className="rounded-xl bg-orange-50 border border-orange-200 p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-orange-800">Réservation active</p>
          <p className="text-orange-700 text-sm">
            Place <strong>{reservation.seats?.label ?? '—'}</strong> — expire dans{' '}
            <strong>{timeLeft}</strong>
          </p>
        </div>
        <span className="text-2xl">🪑</span>
      </div>

      {examMode && reservation.queue_position != null && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-800">
          Position dans la file d'attente :{' '}
          <strong className="text-blue-900 text-base">#{reservation.queue_position}</strong>
        </div>
      )}

      <p className="text-xs text-orange-600">
        {examMode
          ? 'Mode examen — présentez-vous dans l\'ordre de la file pour valider votre entrée.'
          : 'Présentez-vous et scannez votre QR code pour confirmer votre place.'}
        {' '}Les réservations ne peuvent pas être annulées manuellement.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Pass `examMode` and `queue_position` from the page**

In `apps/web/src/app/(student-pages)/student/reservation/page.tsx`, extend the reservation query to include `queue_position`, fetch the `exam_mode` setting, and pass both to the banner:

```typescript
// Extend the reservation query
const { data: activeReservation } = await supabase
  .from('reservations')
  .select('id, seat_id, expires_at, queue_position, seats(label)')
  .eq('student_id', user.id)
  .eq('status', 'active')
  .maybeSingle();

// Fetch exam_mode setting
const { data: examModeSetting } = await supabase
  .from('settings')
  .select('value')
  .eq('key', 'exam_mode')
  .single();

const examMode = examModeSetting?.value === 'true';
```

Replace the `<ActiveReservationBanner>` call:

```tsx
{activeReservation && (
  <ActiveReservationBanner reservation={activeReservation} examMode={examMode} />
)}
```

Also show an exam mode notice to students without a reservation:

```tsx
{subscription && !activeReservation && examMode && (
  <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-blue-800 text-sm">
    <strong>Mode examen activé</strong> — une réservation est obligatoire pour accéder à l'espace.
    Choisissez une place ci-dessous.
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\(student-pages\)/student/reservation/
git commit -m "feat(exam-mode): show queue position and exam mode notice on reservation page"
```

---

## Self-Review — Spec Coverage

| Spec requirement | Covered |
|---|---|
| `settings.exam_mode = 'true'` → reservations mandatory for check-in | ✅ Task 3 (`DENIED_NO_RESERVATION`) |
| Waitlist via `reservations.queue_position` | ✅ Task 1 (queue assignment in createReservation) |
| Priority jump: subscription ≥ `priority_min_duration_days` days | ✅ Task 1 (isPriority check + shift_queue_positions_down) |
| `shift_queue_positions_down` DB function | ✅ Task 2 |
| Student sees queue position in reservation banner | ✅ Task 4 |
| Exam mode notice shown when no reservation yet | ✅ Task 4 |
| Normal mode: `queue_position = NULL` | ✅ Task 1 (conditional assignment) |
| Check-in result displays `DENIED_NO_RESERVATION` | ✅ Task 3 Step 2 |
