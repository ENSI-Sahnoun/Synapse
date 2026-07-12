'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/supabase-clients/client'

export function useLiveRefetch(
  tables: string[],
  onChange: () => void,
  opts?: { debounceMs?: number },
): void {
  const debounceMs = opts?.debounceMs ?? 250
  const cbRef = useRef(onChange)
  cbRef.current = onChange
  const key = tables.join(',')

  useEffect(() => {
    const supabase = createClient()
    const uid = Math.random().toString(36).slice(2, 7)
    let timer: ReturnType<typeof setTimeout> | null = null
    let disposed = false
    let channels: ReturnType<typeof supabase.channel>[] = []

    const fire = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => cbRef.current(), debounceMs)
    }

    // The user JWT must be on the socket BEFORE the first channel joins:
    // a join without access_token subscribes as anon and RLS silently drops
    // every event. setAuth() resolves the session token first.
    void supabase.realtime
      .setAuth()
      .catch(() => {})
      .then(() => {
        if (disposed) return
        channels = key.split(',').map((table) =>
          supabase
            .channel(`live-refetch:${table}:${uid}`)
            .on('postgres_changes', { event: '*', schema: 'public', table }, fire)
            .subscribe(),
        )
      })

    return () => {
      disposed = true
      if (timer) clearTimeout(timer)
      channels.forEach((c) => void supabase.removeChannel(c))
    }
  }, [key, debounceMs])
}
