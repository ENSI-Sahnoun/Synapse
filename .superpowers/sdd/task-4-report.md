# Task 4 Report: Student Notification Sheet

## Status: DONE

## Commit
`3024d66` — feat(notifications): add StudentNotificationSheet in student header bell slot

## TypeScript
`pnpm tsc --noEmit` — 0 errors

## What was done

1. **Created** `apps/web/src/components/notifications/StudentNotificationSheet.tsx`
   - Client component, Phosphor Bell trigger with red badge, bottom sheet (80vh)
   - Correct schema: `is_read: boolean`, optimistic `{ ...n, is_read: true }`
   - Actions from `@/actions/notifications/mark-read`
   - Reuses `NotificationItem`

2. **Modified** `apps/web/src/app/student/layout.tsx`
   - Replaced bell placeholder with `<StudentNotificationSheet>`
   - Added try/catch non-fatal notification fetch
   - Removed unused Bell import
