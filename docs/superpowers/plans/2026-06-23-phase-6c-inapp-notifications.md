# Phase 6C: In-App Notifications (Bell Icon) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display a bell icon with unread count in admin/employee nav and student bottom nav, with a notification dropdown/panel and mark-as-read action.

**Architecture:** A server component fetches the initial unread count and notification list. A server action handles mark-as-read. The bell icon updates unread count on panel open (re-fetch). No Realtime subscription — the panel is polled on open, which is sufficient for notification UX. Instant notifications (reservation confirmed, points earned) are inserted via server actions in those respective flows; this plan wires up the display side only plus the two instant-insert helper calls.

**Tech Stack:** shadcn/ui Popover + Badge, next-safe-action, Zod, Supabase server client

## Global Constraints

- Depends on Phase 1A (notifications table), 1B (action clients), 6A (inapp.ts helper)
- `notifications` table: `id, user_id, type, message, read_at, created_at`
- `read_at IS NULL` = unread
- RLS: students see own notifications; employees/admin see all (already set in Phase 1A — verify if not)
- French UI — all labels in French
- All commands run from `/home/sah/Synapse`

---

### Task 1: Notification data layer

**Files:**
- Create: `apps/web/src/data/notifications/list.ts`
- Create: `apps/web/src/actions/notifications/mark-read.ts`

- [ ] **Step 1: Write list + unread count queries**

```typescript
// apps/web/src/data/notifications/list.ts
'use server'

import { createSupabaseClient } from '@/supabase-clients/server'

export interface NotificationRow {
  id: string
  type: string
  message: string
  read_at: string | null
  created_at: string
}

export async function getMyNotifications(limit = 20): Promise<NotificationRow[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, message, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as NotificationRow[]
}

export async function getMyUnreadCount(): Promise<number> {
  const supabase = await createSupabaseClient()
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
  if (error) throw error
  return count ?? 0
}

export async function getNotificationsForUser(
  userId: string,
  limit = 20,
): Promise<NotificationRow[]> {
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, message, read_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as NotificationRow[]
}
```

- [ ] **Step 2: Write mark-as-read action**

```typescript
// apps/web/src/actions/notifications/mark-read.ts
'use server'

import { z } from 'zod'
import { employeeActionClient } from '@/utils/supabase/action-clients'
import { createSupabaseClient } from '@/supabase-clients/server'

const markOneReadSchema = z.object({
  notificationId: z.string().uuid(),
})

const markAllReadSchema = z.object({})

export const markNotificationRead = employeeActionClient
  .schema(markOneReadSchema)
  .action(async ({ parsedInput: { notificationId } }) => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .is('read_at', null)
    if (error) throw error
    return { success: true }
  })

export const markAllNotificationsRead = employeeActionClient
  .schema(markAllReadSchema)
  .action(async () => {
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null)
    if (error) throw error
    return { success: true }
  })
```

> **Note:** For students, use `studentActionClient` if available, or create a separate `markStudentNotificationRead` action with that client. The RLS policy already scopes updates to `auth.uid() = user_id`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/data/notifications/list.ts \
        apps/web/src/actions/notifications/mark-read.ts
git commit -m "feat(notifications): add notification list queries and mark-as-read actions"
```

---

### Task 2: NotificationBell component

**Files:**
- Create: `apps/web/src/components/notifications/NotificationBell.tsx`
- Create: `apps/web/src/components/notifications/NotificationItem.tsx`

- [ ] **Step 1: Write NotificationItem**

```tsx
// apps/web/src/components/notifications/NotificationItem.tsx
'use client'

import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { NotificationRow } from '@/data/notifications/list'

interface NotificationItemProps {
  notification: NotificationRow
  onMarkRead: (id: string) => void
}

const TYPE_LABELS: Record<string, string> = {
  expiry_7d: 'Expiration dans 7 jours',
  expiry_3d: 'Expiration dans 3 jours',
  expiry_1d: 'Expiration demain',
  expired: 'Abonnement expiré',
  renewal_reminder: 'Rappel de renouvellement',
  reservation_confirmed: 'Réservation confirmée',
  points_earned: 'Points gagnés',
}

export function NotificationItem({ notification, onMarkRead }: NotificationItemProps) {
  const isUnread = notification.read_at === null
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
    locale: fr,
  })

  return (
    <div
      className={cn(
        'flex gap-3 p-3 rounded-lg cursor-pointer transition-colors',
        isUnread ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-muted',
      )}
      onClick={() => isUnread && onMarkRead(notification.id)}
    >
      {isUnread && (
        <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
      )}
      <div className={cn('flex-1 space-y-0.5', !isUnread && 'ml-5')}>
        <p className="text-xs font-medium text-muted-foreground">
          {TYPE_LABELS[notification.type] ?? notification.type}
        </p>
        <p className="text-sm">{notification.message}</p>
        <p className="text-xs text-muted-foreground">{timeAgo}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write NotificationBell**

```tsx
// apps/web/src/components/notifications/NotificationBell.tsx
'use client'

import { useState, useTransition } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { NotificationItem } from './NotificationItem'
import { markNotificationRead, markAllNotificationsRead } from '@/actions/notifications/mark-read'
import type { NotificationRow } from '@/data/notifications/list'

interface NotificationBellProps {
  initialNotifications: NotificationRow[]
  initialUnreadCount: number
}

export function NotificationBell({
  initialNotifications,
  initialUnreadCount,
}: NotificationBellProps) {
  const [notifications, setNotifications] = useState(initialNotifications)
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)
  const [isPending, startTransition] = useTransition()

  function handleMarkRead(id: string) {
    startTransition(async () => {
      await markNotificationRead({ notificationId: id })
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, read_at: new Date().toISOString() } : n,
        ),
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    })
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllNotificationsRead({})
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })),
      )
      setUnreadCount(0)
    })
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={isPending}
              className="text-xs text-blue-600 hover:underline disabled:opacity-50"
            >
              Tout marquer comme lu
            </button>
          )}
        </div>
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Aucune notification
            </p>
          ) : (
            <div className="p-2 space-y-1">
              {notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onMarkRead={handleMarkRead}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/notifications/NotificationBell.tsx \
        apps/web/src/components/notifications/NotificationItem.tsx
git commit -m "feat(notifications): add NotificationBell popover component"
```

---

### Task 3: Wire bell into admin/employee nav

**Files:**
- Modify: `apps/web/src/app/(admin-pages)/admin/layout.tsx` (or the nav component it uses)
- Modify: `apps/web/src/app/(employee-pages)/employee/layout.tsx` (or the nav component it uses)

- [ ] **Step 1: Identify exact nav file for admin**

```bash
find /home/sah/Synapse/apps/web/src/app/\(admin-pages\) -name "*.tsx" | head -20
```

- [ ] **Step 2: Add bell to admin nav**

In the admin layout or Navbar RSC, add the bell fetch and component. Example pattern (adapt to actual file structure):

```tsx
// In the admin layout RSC (Server Component):
import { getMyNotifications, getMyUnreadCount } from '@/data/notifications/list'
import { NotificationBell } from '@/components/notifications/NotificationBell'

// Inside the layout render, alongside existing nav elements:
const [notifications, unreadCount] = await Promise.all([
  getMyNotifications(20),
  getMyUnreadCount(),
])

// In JSX, place in the nav header area:
<NotificationBell
  initialNotifications={notifications}
  initialUnreadCount={unreadCount}
/>
```

- [ ] **Step 3: Add bell to employee nav**

Repeat the same pattern in the employee layout RSC.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(admin-pages\)/admin/layout.tsx \
        apps/web/src/app/\(employee-pages\)/employee/layout.tsx
git commit -m "feat(notifications): wire notification bell into admin and employee nav"
```

---

### Task 4: Wire bell into student bottom nav

**Files:**
- Modify: `apps/web/src/app/(student-pages)/layout.tsx` (or student bottom nav component)
- Create: `apps/web/src/components/notifications/StudentNotificationSheet.tsx`

- [ ] **Step 1: Write student notification sheet (mobile-optimized)**

```tsx
// apps/web/src/components/notifications/StudentNotificationSheet.tsx
'use client'

import { useState, useTransition } from 'react'
import { Bell } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { NotificationItem } from './NotificationItem'
import { markNotificationRead, markAllNotificationsRead } from '@/actions/notifications/mark-read'
import type { NotificationRow } from '@/data/notifications/list'

interface StudentNotificationSheetProps {
  initialNotifications: NotificationRow[]
  initialUnreadCount: number
}

export function StudentNotificationSheet({
  initialNotifications,
  initialUnreadCount,
}: StudentNotificationSheetProps) {
  const [notifications, setNotifications] = useState(initialNotifications)
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)
  const [isPending, startTransition] = useTransition()

  function handleMarkRead(id: string) {
    startTransition(async () => {
      await markNotificationRead({ notificationId: id })
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, read_at: new Date().toISOString() } : n,
        ),
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    })
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllNotificationsRead({})
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })),
      )
      setUnreadCount(0)
    })
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className="relative flex flex-col items-center gap-1 text-xs" aria-label="Notifications">
          <div className="relative">
            <Bell className="h-6 w-6" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-4 w-4 rounded-full p-0 flex items-center justify-center text-[10px]"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </div>
          <span>Alertes</span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl px-0">
        <SheetHeader className="px-4 pb-2 border-b flex-row items-center justify-between">
          <SheetTitle className="text-base">Notifications</SheetTitle>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={isPending}
              className="text-xs text-blue-600 hover:underline disabled:opacity-50"
            >
              Tout lire
            </button>
          )}
        </SheetHeader>
        <ScrollArea className="h-full">
          {notifications.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Aucune notification
            </p>
          ) : (
            <div className="p-4 space-y-2">
              {notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onMarkRead={handleMarkRead}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: Wire into student layout**

In the student layout RSC, fetch notifications and render `StudentNotificationSheet` in the bottom nav:

```tsx
// In student layout RSC:
import { getMyNotifications, getMyUnreadCount } from '@/data/notifications/list'
import { StudentNotificationSheet } from '@/components/notifications/StudentNotificationSheet'

const [notifications, unreadCount] = await Promise.all([
  getMyNotifications(20),
  getMyUnreadCount(),
])

// In bottom nav JSX (alongside QR, Home, Reservations icons):
<StudentNotificationSheet
  initialNotifications={notifications}
  initialUnreadCount={unreadCount}
/>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/notifications/StudentNotificationSheet.tsx \
        apps/web/src/app/\(student-pages\)/layout.tsx
git commit -m "feat(notifications): add student notification sheet in bottom nav"
```

---

### Task 5: Instant notification inserts — reservation and points

**Files:**
- Modify: `apps/web/src/actions/reservations/create.ts` (or wherever reservation creation lives)
- Modify: `apps/web/src/actions/subscriptions/create.ts` (or wherever subscription/points is recorded)

- [ ] **Step 1: Insert notification on reservation confirmed**

In the reservation server action, after successfully inserting the reservation:

```typescript
import { insertInAppNotification } from '@/data/notifications/inapp'

// After successful reservation insert:
await insertInAppNotification({
  userId: studentId,
  type: 'reservation_confirmed',
  message: `Votre réservation pour la place ${seatLabel} est confirmée. Elle expire dans ${holdMinutes} minutes.`,
})
```

> Add `'reservation_confirmed'` to the `CHECK` constraint in a follow-up migration, or use a looser type check in the action for now (the column type is `text`, no DB-level constraint on `type`).

- [ ] **Step 2: Insert notification on points earned**

In the subscription sale server action (Phase 1D), after inserting the loyalty_ledger entry:

```typescript
import { insertInAppNotification } from '@/data/notifications/inapp'

// After loyalty_ledger insert:
await insertInAppNotification({
  userId: studentId,
  type: 'points_earned',
  message: `Vous avez gagné ${pointsEarned} point(s) Synapse pour votre abonnement ${planName}.`,
})
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/actions/reservations/create.ts \
        apps/web/src/actions/subscriptions/create.ts
git commit -m "feat(notifications): insert in-app notifications on reservation and points events"
```

---

### Task 6: RLS verification for notifications table

**Files:**
- Review: `apps/database/supabase/migrations/` — find the existing notifications RLS migration from Phase 1A

- [ ] **Step 1: Verify existing RLS**

```bash
pnpm supabase db execute --db-url "$DATABASE_URL" \
  --command "SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'notifications';"
```

Expected: at least one SELECT policy for `authenticated` users scoped to `auth.uid() = user_id`.

- [ ] **Step 2: If missing — create patch migration**

If Phase 1A did not set up RLS on `notifications`, create:

```sql
-- apps/database/supabase/migrations/20260623400002_notifications_rls.sql

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Students: read and update own notifications only
CREATE POLICY "student_read_own_notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "student_update_own_notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Employees + admin: read all notifications
CREATE POLICY "employee_read_all_notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('admin', 'employee'));

-- Service role insert (for API route and server actions using admin client)
-- The admin client bypasses RLS, so no explicit policy needed for inserts from server actions.
```

- [ ] **Step 3: Apply if created**

```bash
pnpm supabase db push --db-url "$DATABASE_URL"
```

- [ ] **Step 4: Commit if applied**

```bash
git add apps/database/supabase/migrations/20260623400002_notifications_rls.sql
git commit -m "feat(db): ensure RLS policies on notifications table"
```

---

## Self-Review

- [ ] `getMyNotifications` and `getMyUnreadCount` use the scoped Supabase client (RLS applies — students only see own)
- [ ] `markNotificationRead` and `markAllNotificationsRead` also scoped via RLS
- [ ] Bell badge shows correct unread count from SSR initial props
- [ ] Clicking a notification item marks it read optimistically (no full page reload)
- [ ] "Tout marquer comme lu" button resets count to 0 optimistically
- [ ] Student sheet uses `side="bottom"` Sheet (mobile-friendly)
- [ ] Admin/employee uses Popover (desktop-friendly)
- [ ] Instant inserts for `reservation_confirmed` and `points_earned` are non-fatal (wrapped in try/catch in their parent actions)
- [ ] All labels in French
- [ ] No Realtime subscription added — polling on open is sufficient
