'use client'

import { useState, useTransition } from 'react'
import { Bell } from '@phosphor-icons/react/dist/ssr'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
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
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    })
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllNotificationsRead({})
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnreadCount(0)
    })
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="relative cursor-pointer transition-colors duration-150"
          aria-label="Notifications"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <Bell size={20} weight="regular" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl px-0">
        <SheetHeader className="flex-row items-center justify-between border-b px-4 pb-2">
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
            <div className="space-y-2 p-4">
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
