# Task 4 Report — Notifications Migration + In-App Helper

## Status: COMPLETE

## Commits
- `3c13b83` feat(notifications): add notifications table migration and in-app helper

## Files Created
- `apps/database/supabase/migrations/20260623400002_notifications.sql` — notifications table with RLS (student read own, admin read all)
- `apps/web/src/data/notifications/inapp.ts` — `insertInAppNotification`, `buildExpiryWarningMessage`, `buildExpiredMessage`, `buildRenewalReminderMessage`

## Tests
N/A — not required for this task.

## Concerns
- The `as never` cast strategy for untyped tables caused the insert object to also be typed as `never`, rejecting known properties. Used `(supabase.from as any)('notifications')` instead — works cleanly.
- `expiry-queries.ts` has a pre-existing TS error (`Property 'id' does not exist on type 'never'` at line 50) unrelated to this task.
- Migration applied cleanly via `db reset` — all 9 migrations applied, seed ran, containers restarted.
