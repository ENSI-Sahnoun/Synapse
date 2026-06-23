# Phase 4B: Reservation Engine — Creation (Student) + Fulfillment on Check-in

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a student tap a free seat on the live map to create a hold reservation, and automatically fulfill that reservation when the student scans their QR code at check-in.

**Architecture:** A `studentActionClient` server action validates eligibility (active subscription, no existing active reservation) before inserting into `reservations` and updating `seats.status` to `'reserved'` atomically. `expires_at` is computed as `now() + interval '? minutes'` where the value is pulled from `settings.reservation_hold_minutes`. The existing check-in server action (Phase 2B) is extended: after HMAC validation it looks for an active reservation matching the student — if found it sets `reservations.status = 'fulfilled'`, assigns the seat, and creates the attendance row. If no reservation exists it proceeds with normal seat assignment (walk-in path). The student PWA reservation page (`/student/reservation`) embeds the live seat map and opens a confirmation sheet on seat tap.

**Tech Stack:** Next.js 16 server actions, Supabase server client, `studentActionClient` / `employeeActionClient`, `react-konva` (seat map, already built in Phase 3), Supabase Realtime (seat status), Zod (validation)

## Global Constraints

- `studentActionClient` for all student-initiated mutations
- `employeeActionClient` for check-in fulfillment (check-in is employee/kiosk action)
- Cash-only: no payment fields
- French UI strings in all client components
- `expires_at = now() + (reservation_hold_minutes || ' minutes')::interval` — read from `settings` table, never hardcoded
- Students CANNOT cancel — auto-expiry only (no cancel server action)
- One active reservation enforced at DB level (Phase 4A) — server action must catch error code `23505` and return a user-friendly French error
- Run all commands from `/home/sah/Synapse`

---

### Task 1: `createReservation` server action

**Files:**
- Create: `apps/web/src/app/(student-pages)/student/reservation/actions.ts`

- [ ] **Step 1: Write the server action**

```typescript
// apps/web/src/app/(student-pages)/student/reservation/actions.ts
'use server';

import { z } from 'zod';
import { studentActionClient } from '@/clients/action-clients';
import { createSupabaseServerClient } from '@/supabase-clients/server';
import { revalidatePath } from 'next/cache';

const createReservationSchema = z.object({
  seatId: z.string().uuid(),
});

export const createReservation = studentActionClient
  .schema(createReservationSchema)
  .action(async ({ parsedInput: { seatId }, ctx: { user } }) => {
    const supabase = await createSupabaseServerClient();

    // 1. Verify the student has an active subscription
    const today = new Date().toISOString().split('T')[0];
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('id, end_date')
      .eq('student_id', user.id)
      .gte('end_date', today)
      .order('end_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError) throw new Error('Erreur lors de la vérification de l\'abonnement.');
    if (!subscription) {
      return { error: 'Vous devez avoir un abonnement actif pour réserver une place.' };
    }

    // 2. Verify the seat is currently free
    const { data: seat, error: seatError } = await supabase
      .from('seats')
      .select('id, status, label')
      .eq('id', seatId)
      .single();

    if (seatError || !seat) {
      return { error: 'Place introuvable.' };
    }
    if (seat.status !== 'free') {
      return { error: `La place ${seat.label} n'est plus disponible.` };
    }

    // 3. Read hold duration from settings
    const { data: settingRow } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'reservation_hold_minutes')
      .single();

    const holdMinutes = parseInt(settingRow?.value ?? '30', 10);

    // 4. Insert reservation — DB partial unique index rejects a duplicate active reservation
    const expiresAt = new Date(Date.now() + holdMinutes * 60 * 1000).toISOString();

    const { data: reservation, error: insertError } = await supabase
      .from('reservations')
      .insert({
        student_id: user.id,
        seat_id: seatId,
        expires_at: expiresAt,
        status: 'active',
      })
      .select('id')
      .single();

    if (insertError) {
      // 23505 = unique_violation → student already has an active reservation
      if (insertError.code === '23505') {
        return { error: 'Vous avez déjà une réservation active en cours.' };
      }
      throw new Error('Impossible de créer la réservation. Veuillez réessayer.');
    }

    // 5. Mark seat as reserved
    const { error: seatUpdateError } = await supabase
      .from('seats')
      .update({ status: 'reserved' })
      .eq('id', seatId)
      .eq('status', 'free'); // guard against race condition

    if (seatUpdateError) {
      // Rollback reservation if seat update fails
      await supabase.from('reservations').delete().eq('id', reservation.id);
      return { error: 'Impossible de réserver la place. Veuillez en choisir une autre.' };
    }

    revalidatePath('/student/reservation');
    return {
      success: true,
      reservationId: reservation.id,
      expiresAt,
      holdMinutes,
    };
  });
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(student-pages\)/student/reservation/actions.ts
git commit -m "feat(reservation): add createReservation student server action"
```

---

### Task 2: Student reservation page

**Files:**
- Create: `apps/web/src/app/(student-pages)/student/reservation/page.tsx`
- Create: `apps/web/src/app/(student-pages)/student/reservation/ReservationSeatMap.tsx`
- Create: `apps/web/src/app/(student-pages)/student/reservation/ActiveReservationBanner.tsx`

- [ ] **Step 1: Write the page (RSC)**

```tsx
// apps/web/src/app/(student-pages)/student/reservation/page.tsx
import { createSupabaseServerClient } from '@/supabase-clients/server';
import { redirect } from 'next/navigation';
import { ReservationSeatMap } from './ReservationSeatMap';
import { ActiveReservationBanner } from './ActiveReservationBanner';

export const dynamic = 'force-dynamic';

export default async function ReservationPage() {
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Check active subscription
  const today = new Date().toISOString().split('T')[0];
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('end_date')
    .eq('student_id', user.id)
    .gte('end_date', today)
    .limit(1)
    .maybeSingle();

  // Check existing active reservation
  const { data: activeReservation } = await supabase
    .from('reservations')
    .select('id, seat_id, expires_at, seats(label)')
    .eq('student_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  // Fetch rooms + seats for map
  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, name, status, status_note, seats(id, label, position_x, position_y, status)')
    .eq('status', 'open');

  return (
    <div className="flex flex-col gap-4 p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">Réserver une place</h1>

      {!subscription && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700 text-sm">
          Vous devez avoir un abonnement actif pour réserver une place.
        </div>
      )}

      {activeReservation && (
        <ActiveReservationBanner reservation={activeReservation} />
      )}

      {subscription && !activeReservation && (
        <ReservationSeatMap rooms={rooms ?? []} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write the seat map client component**

```tsx
// apps/web/src/app/(student-pages)/student/reservation/ReservationSeatMap.tsx
'use client';

import { useState } from 'react';
import { useAction } from 'next-safe-action/hooks';
import { createReservation } from './actions';
import { toast } from 'sonner';

type Seat = {
  id: string;
  label: string;
  position_x: number;
  position_y: number;
  status: string;
};

type Room = {
  id: string;
  name: string;
  status: string;
  status_note: string | null;
  seats: Seat[];
};

const SEAT_COLORS: Record<string, string> = {
  free: '#22c55e',       // green
  occupied: '#ef4444',   // red
  reserved: '#f97316',   // orange
  out_of_service: '#9ca3af', // gray
};

export function ReservationSeatMap({ rooms }: { rooms: Room[] }) {
  const [pendingSeat, setPendingSeat] = useState<Seat | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { execute, isPending } = useAction(createReservation, {
    onSuccess: ({ data }) => {
      if (data?.error) {
        toast.error(data.error);
        setPendingSeat(null);
        setConfirmOpen(false);
        return;
      }
      toast.success(`Place réservée pour ${data?.holdMinutes} minutes.`);
      setConfirmOpen(false);
      setPendingSeat(null);
      // Page will revalidate via revalidatePath
      window.location.reload();
    },
    onError: () => {
      toast.error('Erreur lors de la réservation. Veuillez réessayer.');
    },
  });

  function handleSeatClick(seat: Seat) {
    if (seat.status !== 'free') return;
    setPendingSeat(seat);
    setConfirmOpen(true);
  }

  function handleConfirm() {
    if (!pendingSeat) return;
    execute({ seatId: pendingSeat.id });
  }

  return (
    <div className="flex flex-col gap-6">
      {rooms.map((room) => (
        <div key={room.id} className="border rounded-xl p-4">
          <h2 className="font-semibold text-lg mb-3">{room.name}</h2>
          <div className="relative bg-gray-50 rounded-lg" style={{ minHeight: 200 }}>
            {room.seats.map((seat) => (
              <button
                key={seat.id}
                onClick={() => handleSeatClick(seat)}
                disabled={seat.status !== 'free'}
                title={seat.label}
                style={{
                  position: 'absolute',
                  left: seat.position_x,
                  top: seat.position_y,
                  width: 36,
                  height: 36,
                  borderRadius: 6,
                  backgroundColor: SEAT_COLORS[seat.status] ?? '#9ca3af',
                  border: pendingSeat?.id === seat.id ? '3px solid #1d4ed8' : '2px solid rgba(0,0,0,0.1)',
                  cursor: seat.status === 'free' ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#fff',
                }}
              >
                {seat.label}
              </button>
            ))}
          </div>
          {/* Legend */}
          <div className="flex gap-3 mt-3 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block"/> Libre</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block"/> Occupée</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-500 inline-block"/> Réservée</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-400 inline-block"/> Hors service</span>
          </div>
        </div>
      ))}

      {/* Confirmation dialog */}
      {confirmOpen && pendingSeat && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold mb-2">Confirmer la réservation</h3>
            <p className="text-gray-600 mb-4">
              Réserver la place <strong>{pendingSeat.label}</strong> ?
              Votre réservation expirera automatiquement si vous ne vous présentez pas avant la fin du délai.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setPendingSeat(null); setConfirmOpen(false); }}
                disabled={isPending}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-700 font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirm}
                disabled={isPending}
                className="flex-1 py-2 rounded-lg bg-green-600 text-white font-medium disabled:opacity-60"
              >
                {isPending ? 'Réservation…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write the active reservation banner**

```tsx
// apps/web/src/app/(student-pages)/student/reservation/ActiveReservationBanner.tsx
'use client';

import { useEffect, useState } from 'react';

type Reservation = {
  id: string;
  seat_id: string;
  expires_at: string;
  seats: { label: string } | null;
};

export function ActiveReservationBanner({ reservation }: { reservation: Reservation }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    function update() {
      const diff = new Date(reservation.expires_at).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Expirée');
        return;
      }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${m}m ${s.toString().padStart(2, '0')}s`);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [reservation.expires_at]);

  return (
    <div className="rounded-xl bg-orange-50 border border-orange-200 p-4">
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
      <p className="text-xs text-orange-600 mt-2">
        Présentez-vous et scannez votre QR code pour confirmer votre place.
        Les réservations ne peuvent pas être annulées manuellement.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(student-pages\)/student/reservation/
git commit -m "feat(student): reservation page with seat map and countdown banner"
```

---

### Task 3: Fulfill reservation on QR check-in

The existing check-in server action lives at `apps/web/src/app/(employee-pages)/employee/checkin/actions.ts` (created in Phase 2B). This task extends it to fulfill an active reservation when found.

**Files:**
- Modify: `apps/web/src/app/(employee-pages)/employee/checkin/actions.ts`

- [ ] **Step 1: Read the current check-in action to locate the insertion point**

Read the file to find the section that creates the attendance row after HMAC validation succeeds. The extension goes immediately after the student is verified (HMAC valid + subscription active) and before the attendance row is inserted.

- [ ] **Step 2: Add reservation fulfillment logic inside the check-in action**

Add the following block immediately before the `attendance` INSERT in the existing `checkInStudent` server action. The variables `studentId` and `supabase` already exist in that scope.

```typescript
// --- Reservation fulfillment (Phase 4B extension) ---
// Look for an active reservation for this student
const { data: activeReservation } = await supabase
  .from('reservations')
  .select('id, seat_id')
  .eq('student_id', studentId)
  .eq('status', 'active')
  .maybeSingle();

let assignedSeatId: string | null = parsedInput.seatId ?? null;

if (activeReservation) {
  // Fulfill the reservation — use the reserved seat
  assignedSeatId = activeReservation.seat_id;

  await supabase
    .from('reservations')
    .update({ status: 'fulfilled' })
    .eq('id', activeReservation.id);

  // Seat will be set to 'occupied' below by the existing seat-update logic
}
// --- End reservation fulfillment ---
```

Then ensure the subsequent `seats.update` call uses `assignedSeatId` (replace the previous hardcoded `parsedInput.seatId` reference with `assignedSeatId`).

- [ ] **Step 3: Extend the check-in response type to signal reservation fulfillment**

In the same file, extend the returned object from the action to include `reservationFulfilled: boolean` so the employee UI can display a confirmation:

```typescript
return {
  status: 'AUTHORIZED' as const,
  studentName: student.full_name,
  planName: subscription.subscription_plans.name,
  expiryDate: subscription.end_date,
  daysRemaining,
  seatLabel: assignedSeat?.label ?? null,
  reservationFulfilled: !!activeReservation,
};
```

- [ ] **Step 4: Display reservation fulfillment in the check-in result UI**

In `apps/web/src/app/(employee-pages)/employee/checkin/CheckInResult.tsx` (or equivalent display component from Phase 2B), add a badge below the AUTHORIZED result when `reservationFulfilled` is true:

```tsx
{result.reservationFulfilled && (
  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5">
    ✓ Réservation confirmée
  </span>
)}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(employee-pages\)/employee/checkin/
git commit -m "feat(checkin): fulfill active reservation on QR check-in"
```

---

### Task 4: Realtime seat status sync on reservation page

**Files:**
- Modify: `apps/web/src/app/(student-pages)/student/reservation/ReservationSeatMap.tsx`

- [ ] **Step 1: Add Supabase Realtime subscription to keep seat colors live**

Add the following import and `useEffect` at the top of `ReservationSeatMap` (before the return). `createSupabaseBrowserClient` is already available from the NextBase starter at `@/supabase-clients/client`.

```typescript
import { createSupabaseBrowserClient } from '@/supabase-clients/client';
import { useEffect, useState } from 'react';
```

Replace the `rooms` prop with a local state initialized from the prop, then subscribe:

```tsx
const [liveRooms, setLiveRooms] = useState(rooms);

useEffect(() => {
  const supabase = createSupabaseBrowserClient();
  const channel = supabase
    .channel('reservation-seat-status')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'seats' },
      (payload) => {
        const updated = payload.new as { id: string; status: string };
        setLiveRooms((prev) =>
          prev.map((room) => ({
            ...room,
            seats: room.seats.map((s) =>
              s.id === updated.id ? { ...s, status: updated.status } : s
            ),
          }))
        );
      }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, []);
```

Replace all references to `rooms` in the JSX with `liveRooms`.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(student-pages\)/student/reservation/ReservationSeatMap.tsx
git commit -m "feat(student): realtime seat status sync on reservation map"
```

---

## Self-Review — Spec Coverage

| Spec requirement | Covered |
|---|---|
| Account holders + active subscription required | ✅ Task 1 Step 1 (subscription check) |
| One active reservation per student (DB-enforced) | ✅ Task 1 (catches 23505) |
| Hold duration from `settings.reservation_hold_minutes` | ✅ Task 1 Step 1 (reads settings row) |
| Student creates reservation by tapping green seat | ✅ Task 2 (ReservationSeatMap) |
| Reservation page at `/student/reservation` | ✅ Task 2 (page.tsx) |
| Students cannot cancel — auto-expiry only | ✅ No cancel action created |
| QR check-in fulfills matching active reservation | ✅ Task 3 |
| Fulfilled → seat → 'occupied' | ✅ Task 3 (reuses existing seat-update logic) |
| Realtime seat color updates | ✅ Task 4 |
| Active reservation countdown shown to student | ✅ Task 2 (ActiveReservationBanner) |
