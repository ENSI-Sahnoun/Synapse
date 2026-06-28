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
  const isUnread = notification.is_read === false
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
