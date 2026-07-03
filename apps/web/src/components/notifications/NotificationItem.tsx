'use client'

import { useRef, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { NotificationRow } from '@/data/notifications/list'

interface NotificationItemProps {
  notification: NotificationRow
  onMarkRead: (id: string) => void
  onClear: (id: string) => void
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

const SWIPE_DISMISS_THRESHOLD = 80

export function NotificationItem({ notification, onMarkRead, onClear }: NotificationItemProps) {
  const isUnread = notification.is_read === false
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
    locale: fr,
  })

  const [dragX, setDragX] = useState(0)
  const [dismissing, setDismissing] = useState(false)
  const startX = useRef<number | null>(null)
  const dragging = useRef(false)

  function handleTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX
    dragging.current = true
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!dragging.current || startX.current === null) return
    const delta = e.touches[0].clientX - startX.current
    // Only allow swiping left (negative) to reveal the "clear" affordance
    setDragX(Math.min(0, delta))
  }

  function handleTouchEnd() {
    dragging.current = false
    if (dragX < -SWIPE_DISMISS_THRESHOLD) {
      setDismissing(true)
      setTimeout(() => onClear(notification.id), 150)
    } else {
      setDragX(0)
    }
  }

  return (
    <div className="relative overflow-hidden rounded-lg">
      <div className="absolute inset-0 flex items-center justify-end bg-destructive px-4 text-xs font-semibold text-white">
        Effacer
      </div>
      <div
        className={cn(
          'relative flex gap-3 p-3 rounded-lg cursor-pointer bg-background',
          isUnread ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-muted',
        )}
        style={{
          transform: `translateX(${dismissing ? -400 : dragX}px)`,
          transition: dragging.current ? 'none' : 'transform 0.15s ease',
          opacity: dismissing ? 0 : 1,
        }}
        onClick={() => !dragging.current && dragX === 0 && isUnread && onMarkRead(notification.id)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
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
    </div>
  )
}
