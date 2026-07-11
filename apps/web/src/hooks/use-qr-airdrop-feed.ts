'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/supabase-clients/client'

export interface QrAirdrop {
  id: string
  studentName: string
  qrToken: string
}

/**
 * Fires `onAirdrop` in realtime whenever the current user (an admin or
 * employee) receives a `qr_airdrop` notification row — inserted by
 * notifyAllStaff() when a student taps "send" on their QR page. This type is
 * deliberately excluded from the bell/toast/history (see
 * data/notifications/list.ts, use-notifications-feed.ts,
 * NotificationToaster.tsx) — this hook is its only consumer.
 *
 * Takes a ref internally so callers can pass an inline callback without
 * causing the realtime channel to be torn down and reopened every render.
 */
export function useQrAirdropFeed(onAirdrop: (drop: QrAirdrop) => void): void {
  const onAirdropRef = useRef(onAirdrop)
  onAirdropRef.current = onAirdrop

  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null

    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id
      if (!uid) return
      channel = supabase
        .channel(`qr-airdrop:${uid}:${Math.random().toString(36).slice(2, 8)}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
          (payload) => {
            const row = payload.new as { id: string; type: string; message: string; link: string | null }
            if (row.type !== 'qr_airdrop' || !row.link) return
            onAirdropRef.current({ id: row.id, studentName: row.message, qrToken: row.link })
          },
        )
        .subscribe()
    })

    return () => {
      if (channel) void supabase.removeChannel(channel)
    }
  }, [])
}
