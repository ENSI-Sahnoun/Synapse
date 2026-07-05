'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Bell } from 'lucide-react'
import { createClient } from '@/supabase-clients/client'
import type { NotificationRow } from '@/data/notifications/list'

// Only the types that have an obvious, single destination page get an entry.
// Unknown types (e.g. announcement_new) just dismiss the toast on tap — this
// is the only place client-side type->route mapping lives; keep it in sync
// with NotificationType (apps/web/src/lib/notification-types.ts) only for the
// types that actually need a tap destination.
const TYPE_ROUTES: Record<string, string> = {
  expiry_7d: '/student/dashboard',
  expiry_3d: '/student/dashboard',
  expiry_1d: '/student/dashboard',
  expired: '/student/dashboard',
  renewal_reminder: '/student/dashboard',
  subscription_new: '/student/dashboard',
  purchase_completed: '/student/dashboard',
  reservation_confirmed: '/student/reservation',
  reservation_cancelled: '/student/reservation',
  reservation_accepted: '/student/reservation',
  reservation_new: '/employee/reservations',
  seat_swap_request_new: '/employee/reservations',
  seat_swap_accepted: '/student/reservation',
  seat_swap_denied: '/student/reservation',
  loyalty_request_new: '/employee/loyalty-requests',
  loyalty_fulfilled: '/student/loyalty',
  loyalty_rejected: '/student/loyalty',
  points_earned: '/student/loyalty',
  room_almost_full: '/student/rooms',
}

/** Side-effect-only: raises a top-center toast for realtime notification
 * INSERTs for the current authed user. Renders nothing. Mounted once, high
 * up in the tree (see DynamicLayoutProviders), so it fires app-wide. */
export function NotificationToaster() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id
      if (!uid || cancelled) return
      channel = supabase
        // Unique suffix: same collision-avoidance trick as NotificationBell —
        // Supabase reuses a channel by topic, so a shared topic across the
        // bell and toaster (both mounted app-wide) would throw.
        .channel(`notifications-toast:${uid}:${Math.random().toString(36).slice(2, 8)}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
          (payload) => {
            const row = payload.new as NotificationRow
            const route = TYPE_ROUTES[row.type]
            toast(row.message, {
              position: 'top-center',
              icon: <Bell className="h-4 w-4" />,
              action: route
                ? { label: 'Voir', onClick: () => router.push(route) }
                : undefined,
            })
          },
        )
        .subscribe()
    })

    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [router])

  return null
}
