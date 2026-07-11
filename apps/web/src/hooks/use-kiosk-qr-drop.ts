'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/supabase-clients/client'

export interface KioskQrDrop {
  id: string
  studentId: string
  studentName: string
  qrToken: string
}

const DISPLAY_TIMEOUT_MS = 30_000

/**
 * Owns the full lifecycle of a kiosk QR display: receives a `kiosk_qr_drop`
 * notification for the current (kiosk) account, shows it, and clears it on
 * whichever of these happens first:
 *  - 30s elapse
 *  - a `kiosk_qr_drop_cancel` row arrives for the same student (staff hit
 *    "Arrêter")
 *  - the dropped student gets an `attendance` row inserted anywhere (they
 *    were checked in — from any device, any station)
 *  - a new `kiosk_qr_drop` arrives for a different student (last-write-wins)
 */
export function useKioskQrDrop(): { drop: KioskQrDrop | null } {
  const [drop, setDrop] = useState<KioskQrDrop | null>(null)

  // Notifications feed: start/cancel signals.
  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null

    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id
      if (!uid) return
      channel = supabase
        .channel(`kiosk-qr-drop:${uid}:${Math.random().toString(36).slice(2, 8)}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
          (payload) => {
            const row = payload.new as {
              id: string
              type: string
              message: string
              link: string | null
              student_id: string | null
            }
            if (row.type === 'kiosk_qr_drop' && row.link && row.student_id) {
              setDrop({ id: row.id, studentId: row.student_id, studentName: row.message, qrToken: row.link })
            } else if (row.type === 'kiosk_qr_drop_cancel' && row.student_id) {
              setDrop((prev) => (prev && prev.studentId === row.student_id ? null : prev))
            }
          },
        )
        .subscribe()
    })

    return () => {
      if (channel) void supabase.removeChannel(channel)
    }
  }, [])

  // 30s display timeout, restarts whenever the active drop's id changes.
  useEffect(() => {
    if (!drop) return
    const timer = setTimeout(() => {
      setDrop((prev) => (prev?.id === drop.id ? null : prev))
    }, DISPLAY_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [drop])

  // Auto-revert the instant the dropped student is checked in anywhere.
  useEffect(() => {
    if (!drop) return
    const supabase = createClient()
    const channel = supabase
      .channel(`kiosk-qr-drop-attendance:${drop.studentId}:${Math.random().toString(36).slice(2, 8)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendance', filter: `student_id=eq.${drop.studentId}` },
        () => {
          setDrop((prev) => (prev?.id === drop.id ? null : prev))
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [drop])

  return { drop }
}
