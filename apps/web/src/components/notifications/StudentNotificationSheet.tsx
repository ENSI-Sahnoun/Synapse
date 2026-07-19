'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence } from 'motion/react'
import { Bell, X } from '@phosphor-icons/react/dist/ssr'
import { createClient } from '@/supabase-clients/client'
import { notificationHref } from '@/lib/notification-links'
import {
  Sheet,
  SheetClose,
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
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // Live-update the bell for this student. RLS already scopes the stream to
  // their own rows; filter by user_id anyway to be explicit.
  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    // The auth round-trip can resolve after unmount; without this flag we would
    // subscribe a channel nothing will ever tear down.
    let cancelled = false
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id
      if (!uid || cancelled) return
      channel = supabase
        .channel(`notifications:${uid}:${Math.random().toString(36).slice(2, 8)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as NotificationRow
            setNotifications((prev) => (prev.find((n) => n.id === row.id) ? prev : [row, ...prev]))
            if (!row.is_read) setUnreadCount((c) => c + 1)
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as NotificationRow
            setNotifications((prev) => {
              const existing = prev.find((n) => n.id === row.id)
              if (existing && existing.is_read !== row.is_read) {
                setUnreadCount((c) => Math.max(0, c + (row.is_read ? -1 : 1)))
              }
              return prev.map((n) => (n.id === row.id ? row : n))
            })
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as { id: string }
            setNotifications((prev) => prev.filter((n) => n.id !== old.id))
          }
        })
        .subscribe()
    })
    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [])

  function handleMarkRead(id: string) {
    // Only an actually-unread row moves the badge, otherwise re-taps drift it down.
    const wasUnread = notifications.find((n) => n.id === id)?.is_read === false
    startTransition(async () => {
      await markNotificationRead({ notificationId: id })
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      )
      if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1))
    })
  }

  // Actionable notification tapped: mark read, close the sheet, go to its page.
  function handleOpen(id: string, href: string) {
    const wasUnread = notifications.find((n) => n.id === id)?.is_read === false
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
    if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1))
    setOpen(false)
    startTransition(async () => {
      await markNotificationRead({ notificationId: id })
      router.push(href)
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
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center transition-colors duration-150"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} non lues` : 'Notifications'}
          style={{ color: 'var(--muted-foreground)' }}
        >
          {/* Inner wrapper keeps the badge pinned to the icon, not to the 44px hit area */}
          <span className="relative flex">
            <Bell size={20} weight="regular" />
            {unreadCount > 0 && (
              <span
                className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-white"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </span>
        </button>
      </SheetTrigger>
      {/* hideClose: the default top-right X would sit on top of the header actions. */}
      <SheetContent side="bottom" hideClose className="flex h-[80vh] flex-col rounded-t-2xl px-0 pt-3">
        {/* Drag-handle grabber — reads as a draggable bottom sheet on mobile */}
        <div
          aria-hidden="true"
          className="mx-auto mb-3 h-1 w-10 rounded-full"
          style={{ background: 'var(--border-default)' }}
        />
        <SheetHeader className="flex-row items-center justify-between border-b px-4 pb-2">
          <SheetTitle className="text-base">Notifications</SheetTitle>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={isPending}
                className="text-xs text-primary hover:underline disabled:opacity-50"
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
            <SheetClose
              aria-label="Fermer"
              className="-mr-2 flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <X size={16} weight="bold" />
            </SheetClose>
          </div>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          {notifications.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Aucune notification
            </p>
          ) : (
            <div className="space-y-2 p-4">
              <AnimatePresence initial={false}>
                {notifications.map((n) => (
                  <NotificationItem
                    key={n.id}
                    onClear={handleClear}
                    notification={n}
                    onMarkRead={handleMarkRead}
                    href={notificationHref(n.type)}
                    onOpen={handleOpen}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
