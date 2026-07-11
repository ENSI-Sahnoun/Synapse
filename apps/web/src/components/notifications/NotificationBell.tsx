'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence } from 'motion/react'
import { Bell, BellPlus } from 'lucide-react'
import { usePushSubscription } from '@/hooks/use-push-subscription'
import { resolveNotificationHref } from '@/lib/notification-links'
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
  notifications: NotificationRow[]
  unreadCount: number
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onClear: (id: string) => void
  onClearAll: () => void
}

export function NotificationBell({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onClear,
  onClearAll,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const { supported: pushSupported, subscribed: pushSubscribed, subscribe: enablePush } = usePushSubscription()

  function handleMarkRead(id: string) {
    onMarkRead(id)
    startTransition(async () => {
      await markNotificationRead({ notificationId: id })
    })
  }

  function handleOpen(id: string, href: string) {
    onMarkRead(id)
    setOpen(false)
    startTransition(async () => {
      await markNotificationRead({ notificationId: id })
    })
    router.push(href)
  }

  function handleMarkAllRead() {
    onMarkAllRead()
    startTransition(async () => {
      await markAllNotificationsRead({})
    })
  }

  function handleClear(id: string) {
    onClear(id)
    startTransition(async () => {
      await clearNotification({ notificationId: id })
    })
  }

  function handleClearAll() {
    onClearAll()
    startTransition(async () => {
      await clearAllNotifications({})
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5 text-white hover:text-amber-800" />
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
                className="flex items-center gap-1 text-xs text-primary hover:underline"
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
                className="text-xs text-primary hover:underline disabled:opacity-50"
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
                    href={resolveNotificationHref(n)}
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
