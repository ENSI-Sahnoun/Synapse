'use client'

import { useState, useTransition, useEffect } from 'react'
import { Bell } from '@phosphor-icons/react/dist/ssr'
import { createClient } from '@/supabase-clients/client'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { NotificationItem } from './NotificationItem'
import { markNotificationRead, markAllNotificationsRead, clearNotification, clearAllNotifications } from '@/actions/notifications/mark-read'
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

  // Live-update the bell for this student. RLS already scopes the stream to
  // their own rows; filter by user_id anyway to be explicit.
  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id
      if (!uid) return
      channel = supabase
        .channel(`notifications:${uid}:${Math.random().toString(36).slice(2, 8)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as NotificationRow
            setNotifications((prev) => (prev.find((n) => n.id === row.id) ? prev : [row, ...prev]))
            if (!row.is_read) setUnreadCount((c) => c + 1)
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as NotificationRow
            setNotifications((prev) => prev.map((n) => (n.id === row.id ? row : n)))
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as { id: string }
            setNotifications((prev) => prev.filter((n) => n.id !== old.id))
          }
        })
        .subscribe()
    })
    return () => { if (channel) void supabase.removeChannel(channel) }
  }, [])

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

  function handleClear(id: string) {
    const wasUnread = notifications.find((n) => n.id === id)?.is_read === false
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1))
    startTransition(async () => {
      await clearNotification({ notificationId: id })
    })
  }

  function handleClearAll() {
    setNotifications([])
    setUnreadCount(0)
    startTransition(async () => {
      await clearAllNotifications({})
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
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={isPending}
                className="text-xs text-blue-600 hover:underline disabled:opacity-50"
              >
                Tout lire
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={handleClearAll}
                disabled={isPending}
                className="text-xs text-destructive hover:underline disabled:opacity-50"
              >
                Tout effacer
              </button>
            )}
          </div>
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
                  onClear={handleClear}
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
