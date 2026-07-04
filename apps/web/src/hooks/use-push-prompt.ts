'use client'

import { useEffect, useState } from 'react'
import { usePushSubscription } from './use-push-subscription'
import { createClient } from '@/supabase-clients/client'

const LAST_DISMISSED_KEY = 'push-prompt-last-dismissed'
const RENAG_DAYS = 3

export function usePushPrompt() {
  const { supported, subscribed, subscribe } = usePushSubscription()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!supported || subscribed) return
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return

    const lastDismissed = Number(localStorage.getItem(LAST_DISMISSED_KEY) ?? 0)
    const daysSince = (Date.now() - lastDismissed) / (1000 * 60 * 60 * 24)
    if (daysSince < RENAG_DAYS) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!cancelled && data.user) timer = setTimeout(() => setOpen(true), 4000)
      })
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [supported, subscribed])

  function dismiss() {
    localStorage.setItem(LAST_DISMISSED_KEY, String(Date.now()))
    setOpen(false)
  }

  async function enable() {
    await subscribe()
    setOpen(false)
  }

  return { open, dismiss, enable }
}
