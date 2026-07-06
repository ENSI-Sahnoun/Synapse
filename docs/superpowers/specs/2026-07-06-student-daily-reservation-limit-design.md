# Student Daily Reservation Limit

## Goal

Cap each student at a maximum number of reservations per calendar day (default **3**).
This is separate from the existing "1 active reservation per student" rule: a student
may create, let expire, create again — but only up to the daily cap.

## Count rule

A reservation counts toward the daily limit when:

- `student_id` = the current student, and
- `reserved_at` falls on today (UTC midnight boundary), and
- `status != 'cancelled'`

So `active`, `expired`, `fulfilled`, and `confirmed` rows count; student-cancelled
rows do **not**. Cancelling a reservation frees a daily slot.

## Limit source

Reuse the existing `settings` table pattern (same as `reservation_hold_minutes`).

- New key `max_reservations_per_day`, seeded to `'3'`.
- Server action reads it with a `?? '3'` fallback, so absence is safe.
- Admin-tunable via the settings table.

## Enforcement

Action-only. `createReservation` is the sole student write path; RLS blocks direct
student inserts to `reservations`. No DB trigger (YAGNI). The existing 1-active-per-student
partial unique index is unaffected.

## Implementation

### 1. Migration — seed the setting

New migration under `apps/database/supabase/migrations/`:

```sql
INSERT INTO public.settings (key, value) VALUES
  ('max_reservations_per_day', '3')
ON CONFLICT (key) DO NOTHING;
```

### 2. Server action guard

In `apps/web/src/actions/student/reservations.ts`, inside `createReservation`,
add a new guard **after** step 2b (active-reservation check, ~line 70) and
**before** step 3 (seat-free check).

- Read `max_reservations_per_day` from settings (fallback `'3'`).
- Count reservations for `userId` with `reserved_at >= today` (the `today` var already
  computed at line 20) and `status != 'cancelled'`, using a `head: true` count query.
- If `count >= limit` → `return { error: 'Vous avez atteint la limite de N réservations par jour.' }`
  (interpolate the actual limit).

```ts
const { data: limitRow } = await supabase
  .from('settings')
  .select('value')
  .eq('key', 'max_reservations_per_day')
  .maybeSingle()
const maxPerDay = parseInt(limitRow?.value ?? '3', 10)

const { count: todayCount } = await supabase
  .from('reservations')
  .select('id', { count: 'exact', head: true })
  .eq('student_id', userId)
  .gte('reserved_at', today)              // 'YYYY-MM-DD' → 00:00Z
  .neq('status', 'cancelled')

if ((todayCount ?? 0) >= maxPerDay) {
  return { error: `Vous avez atteint la limite de ${maxPerDay} réservations par jour.` }
}
```

## Testing (manual)

1. Create 3 reservations (letting each expire) → 4th is blocked with the limit message.
2. Cancel one of today's reservations → non-cancelled count drops → a further reservation
   is allowed again.
3. New calendar day (UTC) → counter resets.

## Out of scope

- DB-trigger enforcement.
- Admin UI card for editing the setting (edit via settings table directly for now).
- Per-plan / per-tier variable limits.
