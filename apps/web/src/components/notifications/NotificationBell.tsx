'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence } from 'motion/react'
import { Bell, BellPlus } from 'lucide-react'
import { usePushSubscription } from '@/hooks/use-push-subscription'
import { createClient } from '@/supabase-clients/client'
import { notificationHref } from '@/lib/notification-links'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { NotificationItem } from './NotificationItem'
import { markNotificationRead, markAllNotificationsRead, clearNotification, clearAllNotifications } from '@/actions/notifications/mark-read'
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
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const { supported: pushSupported, subscribed: pushSubscribed, subscribe: enablePush } = usePushSubscription()

  // Live-update the bell: new/changed/removed notifications for this user.
  // RLS scopes the stream, but filter by user_id too so admins (who can read
  // all) only get their own bell events.
  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id
      if (!uid) return
      channel = supabase
        // Unique suffix: the same bell can be mounted more than once (e.g. two
        // nav bars), and Supabase reuses a channel by topic — a shared topic
        // throws "cannot add postgres_changes callbacks after subscribe()".
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
        prev.map((n) =>
          n.id === id ? { ...n, is_read: true } : n,
        ),
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    })
  }

  function handleOpen(id: string, href: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
    setUnreadCount((prev) => Math.max(0, prev - 1))
    setOpen(false)
    startTransition(async () => {
      await markNotificationRead({ notificationId: id })
    })
    router.push(href)
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllNotificationsRead({})
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true })),
      )
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
    <Popover open={open} onOpenChange={setOpen}>
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
          <div className="flex items-center gap-3">
            {pushSupported && !pushSubscribed && (
              <button
                onClick={() => void enablePush()}
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                title="Recevoir les notifications sur ce téléphone"
              >
                <BellPlus className="h-3.5 w-3.5" />
                Activer
              </button>
            )}
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={isPending}
                className="text-xs text-blue-600 hover:underline disabled:opacity-50"
              >
                Tout marquer comme lu
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
        </div>
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Aucune notification
            </p>
          ) : (
            <div className="p-2 space-y-1">
              <AnimatePresence initial={false}>
                {notifications.map((n) => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onMarkRead={handleMarkRead}
                    onClear={handleClear}
                    href={notificationHref(n.type)}
                    onOpen={handleOpen}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
