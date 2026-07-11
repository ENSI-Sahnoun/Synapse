'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Bell } from 'lucide-react'
import { createClient } from '@/supabase-clients/client'
import type { NotificationRow } from '@/data/notifications/list'
import { resolveNotificationHref } from '@/lib/notification-links'

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
            if (row.type === 'qr_airdrop') return
            const route = resolveNotificationHref(row)
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
