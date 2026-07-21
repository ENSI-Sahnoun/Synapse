'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Bell } from 'lucide-react'
import { createClient } from '@/supabase-clients/client'
import type { NotificationRow } from '@/data/notifications/list'
import { resolveNotificationHref } from '@/lib/notification-links'
import { INTERNAL_NOTIFICATION_TYPES } from '@/lib/notification-types'

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
            if ((INTERNAL_NOTIFICATION_TYPES as readonly string[]).includes(row.type)) return
            const route = resolveNotificationHref(row)
            const toastOpts = {
              position: 'top-center' as const,
              action: route
                ? { label: 'Voir', onClick: () => router.push(route) }
                : undefined,
            }

            if (
              row.type === 'achievement_progress' &&
              row.progress_current != null &&
              row.progress_target != null &&
              row.progress_target > 0
            ) {
              const pct = Math.min(100, Math.round((row.progress_current / row.progress_target) * 100))
              toast(
                <div className="flex flex-col gap-1.5 w-full">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 shrink-0" />
                    <span className="text-sm">{row.message}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full overflow-hidden bg-muted">
                    <div
                      className="h-full rounded-full transition-[width] duration-500 ease-out"
                      style={{ width: `${pct}%`, background: 'var(--synapse-green-600)' }}
                    />
                  </div>
                </div>,
                toastOpts,
              )
              return
            }

            toast(row.message, { ...toastOpts, icon: <Bell className="h-4 w-4" /> })
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
