'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Megaphone, X } from '@phosphor-icons/react'
import { createClient } from '@/supabase-clients/client'
import { clearNotification } from '@/actions/notifications/mark-read'
import type { ImportantNotificationRow } from '@/data/notifications/list'

/**
 * Important announcements are broadcast as one notification row per student
 * (see notifyAllUsers), so realtime INSERTs land on this exact user's channel
 * — no extra fan-out needed to make a just-sent announcement appear instantly.
 */
export function ImportantAnnouncements({ initial }: { initial: ImportantNotificationRow[] }) {
  const [items, setItems] = useState(initial)

  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null

    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id
      if (!uid) return
      channel = supabase
        .channel(`important-announcements:${uid}:${Math.random().toString(36).slice(2, 8)}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const row = payload.new as ImportantNotificationRow
              const isActiveAnnouncement =
                row.is_important && row.important_until && new Date(row.important_until) > new Date()
              if (!isActiveAnnouncement) return
              setItems((prev) => (prev.find((n) => n.id === row.id) ? prev : [row, ...prev]))
            } else if (payload.eventType === 'DELETE') {
              const old = payload.old as { id: string }
              setItems((prev) => prev.filter((n) => n.id !== old.id))
            }
          },
        )
        .subscribe()
    })

    return () => {
      if (channel) void supabase.removeChannel(channel)
    }
  }, [])

  function dismiss(id: string) {
    setItems((prev) => prev.filter((n) => n.id !== id))
    void clearNotification({ notificationId: id })
  }

  return (
    <AnimatePresence initial={false}>
      {items.map((n) => (
        <motion.div
          key={n.id}
          layout
          initial={{ opacity: 0, y: -8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-xl flex items-start gap-3 px-4 py-3 mb-3 overflow-hidden"
          style={{ background: 'var(--error-bg)', border: '1px solid var(--error-border)' }}
        >
          <Megaphone size={18} weight="fill" style={{ color: 'var(--destructive)', flexShrink: 0, marginTop: 2 }} />
          <p className="text-sm font-semibold flex-1" style={{ color: 'var(--error-text)' }}>{n.message}</p>
          <button
            onClick={() => dismiss(n.id)}
            aria-label="Fermer l'annonce"
            className="shrink-0 -m-2 p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-black/5"
          >
            <X size={16} style={{ color: 'var(--error-text)' }} />
          </button>
        </motion.div>
      ))}
    </AnimatePresence>
  )
}
