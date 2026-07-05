# Kiosk Seat Selection — Design

Date: 2026-07-05

## Goal

After a successful QR check-in at the kiosk, prompt the student to choose a
room and seat with a large, dead-simple full-screen UI. Enlarge the scanner.
Support students who defer the choice — they check in seatless and get a prompt
on their own dashboard to pick a seat later from their phone.

## Flow

`KioskClient` becomes a 3-state machine (currently a fixed split layout):

| State       | Screen                                                        |
|-------------|---------------------------------------------------------------|
| `scanning`  | Enlarged, centered QR scanner + manual entry (full screen)    |
| `selecting` | Near-full-screen seat picker (`KioskSeatPicker`)              |
| `result`    | `KioskResult` welcome / denied                                |

Routing after a scan result:

- Denied / already-in / unknown → `result`, auto-reset after 2.5s (unchanged).
- `AUTHORIZED` **with reserved seat** → `result` welcome that names the reserved
  room + seat, plus a small **Changer de place** button → `selecting`
  (pre-highlight current seat, confirm uses `changeSeatAction`).
- `AUTHORIZED` **without seat** (walk-in) → `selecting`, no timeout.

## `selecting` screen — `KioskSeatPicker.tsx` (new)

- Header: student name + "Choisissez votre place".
- Big room **tabs** (one per room) switch a single large `LiveSeatMap`
  (`mode="student"`, `allowFullscreen`). `LiveSeatMap` self-subscribes to
  realtime seat updates, so load-staleness is a non-issue.
- Tap a free seat → bottom confirm bar: "Place {label} — Confirmer / Annuler".
- Confirm → `assignSeatToAttendanceAction` (walk-in) or `changeSeatAction`
  (reserved change) → `result` welcome (auto-reset).
- Skip button labelled **"Je ne suis pas sûr — je choisirai depuis mon
  téléphone plus tard"** → straight to welcome, attendance stays seatless
  (`presence.status === 'divers'`).

## Dashboard prompt (defer path)

`student/dashboard` already loads `presence`. When `presence.status === 'divers'`
render a prominent card — **"Vous avez fait votre choix ?"** — with a **Choisir
ma place** button linking to `/student/reservation`. No new flag: the divers
state is the signal (also covers a student an employee moved to Divers).

On `/student/reservation`, add one branch to `ReservationSeatMap`: when the
tapping student is **present + divers**, a free-seat tap calls the new
`claimSeat` action (direct occupy, no staff approval) instead of the
`requestSeatSwap` path used by seated students.

## Backend

- Extend the `AUTHORIZED` `CheckinResult` with `seatId`, `seatLabel`, `roomId`,
  `roomName` (all optional/nullable). `checkin-action` already knows the
  reservation `seat_id` + `room_id`; fetch the labels when a reservation was
  fulfilled. `attendanceId` is already returned.
- New student action `claimSeat({ seatId, roomId })` in `seat-swap.ts` — same
  logic as the existing `undoMoveSelfToDivers` (assert caller is seatless,
  atomically flip a free seat to occupied, bind it to the open attendance).
- `kiosk/page.tsx` (server, `force-dynamic`) fetches every room with
  tables + seats and passes them to `KioskClient`.

## Reused, unchanged

`assignSeatToAttendanceAction`, `changeSeatAction`, `moveSelfToDivers`,
`LiveSeatMap`, `getMyPresence`.

## Out of scope

No phone push notification — the prompt is the dashboard state only.

## Touched / new files

- `KioskSeatPicker.tsx` (new)
- `components/student/DiversSeatPrompt.tsx` (new)
- `KioskClient.tsx`, `KioskResult.tsx`, `kiosk/page.tsx`
- `checkin-action.ts`, `utils/zod-schemas/checkin.ts`
- `actions/student/seat-swap.ts`
- `app/student/dashboard/page.tsx`
- `app/student/reservation/ReservationSeatMap.tsx`
