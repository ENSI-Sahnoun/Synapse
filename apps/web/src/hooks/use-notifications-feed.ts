'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/supabase-clients/client'
import type { NotificationRow } from '@/data/notifications/list'

/**
 * Owns the live notification list for the current user: one realtime
 * subscription, shared by every consumer (the bell, in both its desktop and
 * mobile mounts, and the nav badge counts) instead of each mount opening its
 * own channel.
 */
export function useNotificationsFeed(initialNotifications: NotificationRow[], initialUnreadCount: number) {
  const [notifications, setNotifications] = useState(initialNotifications)
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)

  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id
      if (!uid) return
      channel = supabase
        .channel(`notifications:${uid}:${Math.random().toString(36).slice(2, 8)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as NotificationRow
            setNotifications((prev) => (prev.find((n) => n.id === row.id) ? prev : [row, ...prev]))
            if (!row.is_read) setUnreadCount((c) => c + 1)
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as NotificationRow
            setNotifications((prev) => prev.map((n) => (n.id === row.id ? row : n)))
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as { id: string }
            setNotifications((prev) => prev.filter((n) => n.id !== old.id))
          }
        })
        .subscribe()
    })
    return () => { if (channel) void supabase.removeChannel(channel) }
  }, [])

  function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  function clear(id: string) {
    const wasUnread = notifications.find((n) => n.id === id)?.is_read === false
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1))
  }

  function clearAll() {
    setNotifications([])
    setUnreadCount(0)
  }

  return { notifications, unreadCount, markRead, markAllRead, clear, clearAll }
}
