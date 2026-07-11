'use client'

import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import {
  Armchair, Star, Gift, Clock, WarningCircle, Megaphone,
  Bell, XCircle, CaretRight, CreditCard, Users, type Icon as PhosphorIcon,
} from '@phosphor-icons/react'
import type { NotificationRow } from '@/data/notifications/list'

interface NotificationItemProps {
  notification: NotificationRow
  onMarkRead: (id: string) => void
  onClear: (id: string) => void
  /** Destination for actionable notifications; null → informational only. */
  href?: string | null
  /** Called when an actionable notification is tapped (navigate + mark read). */
  onOpen?: (id: string, href: string) => void
}

type Tone = 'green' | 'amber' | 'red' | 'orange' | 'brand' | 'neutral'

// Context drives the whole look: each notification kind gets its own icon,
// friendly label and colour — so a cancelled reservation reads red, points
// earned glow amber, an announcement reads brand brown, etc. No more raw type strings.
function metaFor(type: string): { Icon: PhosphorIcon; label: string; tone: Tone } {
  if (type === 'reservation_cancelled' || type === 'seat_swap_denied') return { Icon: XCircle, label: 'Réservation refusée', tone: 'red' }
  if (type === 'seat_removed_by_staff') return { Icon: WarningCircle, label: 'Place retirée', tone: 'red' }
  if (type.startsWith('reservation') || type.startsWith('seat')) return { Icon: Armchair, label: 'Réservation', tone: 'green' }
  if (type === 'points_earned') return { Icon: Star, label: 'Points gagnés', tone: 'amber' }
  if (type === 'loyalty_fulfilled') return { Icon: Gift, label: 'Récompense validée', tone: 'amber' }
  if (type === 'loyalty_rejected') return { Icon: XCircle, label: 'Récompense refusée', tone: 'red' }
  if (type.startsWith('loyalty')) return { Icon: Gift, label: 'Récompense', tone: 'amber' }
  if (type === 'expired') return { Icon: WarningCircle, label: 'Abonnement expiré', tone: 'red' }
  if (type.startsWith('expiry') || type === 'renewal_reminder') return { Icon: Clock, label: 'Expiration proche', tone: 'orange' }
  if (type === 'subscription_new' || type === 'purchase_completed') return { Icon: CreditCard, label: 'Paiement', tone: 'green' }
  if (type === 'room_almost_full') return { Icon: Users, label: 'Salle presque pleine', tone: 'orange' }
  if (type === 'broadcast' || type === 'manual' || type === 'announcement_new') return { Icon: Megaphone, label: 'Annonce', tone: 'brand' }
  return { Icon: Bell, label: 'Notification', tone: 'neutral' }
}

const TONE: Record<Tone, { fg: string; bg: string }> = {
  green: { fg: 'var(--synapse-green-700)', bg: 'var(--synapse-green-50)' },
  amber: { fg: 'var(--synapse-orange-500)', bg: 'var(--synapse-orange-50)' },
  red: { fg: 'var(--destructive)', bg: '#fee2e2' },
  orange: { fg: 'var(--synapse-orange-700)', bg: 'var(--synapse-orange-100)' },
  brand: { fg: 'var(--synapse-brown-600)', bg: 'var(--synapse-brown-50)' },
  neutral: { fg: 'var(--muted-foreground)', bg: 'var(--muted)' },
}

const SWIPE_DISMISS_THRESHOLD = 80

export function NotificationItem({ notification, onMarkRead, onClear, href, onOpen }: NotificationItemProps) {
  const isUnread = notification.is_read === false
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: fr })
  const { Icon, label, tone } = metaFor(notification.type)
  const colors = TONE[tone]
  const actionable = !!href && !!onOpen

  const [dragX, setDragX] = useState(0)
  const startX = useRef<number | null>(null)
  const dragging = useRef(false)

  function handleTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX
    dragging.current = true
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!dragging.current || startX.current === null) return
    const delta = e.touches[0].clientX - startX.current
    setDragX(Math.min(0, delta)) // swipe-left only reveals "Effacer"
  }

  function handleTouchEnd() {
    dragging.current = false
    if (dragX < -SWIPE_DISMISS_THRESHOLD) onClear(notification.id)
    else setDragX(0)
  }

  function handleRowClick() {
    if (dragging.current || dragX !== 0) return
    if (isUnread) onMarkRead(notification.id)
  }

  function handleVoirClick(e: React.MouseEvent) {
    e.stopPropagation()
    onOpen!(notification.id, href!)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, height: 0, marginTop: 0, scale: 0.95 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-xl"
    >
      {/* Swipe-to-clear affordance revealed underneath */}
      <div className="absolute inset-0 flex items-center justify-end bg-destructive px-4 text-xs font-semibold text-white">
        Effacer
      </div>

      <div
        className={cn(
          'relative flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-[background-color,transform] active:scale-[0.99]',
          isUnread ? 'bg-blue-50 hover:bg-blue-100' : 'bg-background hover:bg-muted',
        )}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging.current ? 'none' : 'transform 0.15s ease',
        }}
        onClick={handleRowClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Context icon */}
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ background: colors.bg, color: colors.fg }}
        >
          <Icon size={18} weight={isUnread ? 'fill' : 'regular'} />
        </div>

        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: colors.fg }}>
              {label}
            </p>
            {isUnread && (
              <motion.span
                className="h-1.5 w-1.5 rounded-full bg-blue-500"
                animate={{ opacity: [1, 0.35, 1], scale: [1, 0.8, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
          </div>
          <p className="text-sm leading-snug text-foreground">{notification.message}</p>
          <p className="text-xs text-muted-foreground">{timeAgo}</p>
        </div>

        {actionable && (
          <button
            onClick={handleVoirClick}
            className="mt-0.5 shrink-0 flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
          >
            Voir
            <CaretRight size={12} />
          </button>
        )}
      </div>
    </motion.div>
  )
}
