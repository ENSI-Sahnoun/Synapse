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

    const fire = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => cbRef.current(), debounceMs)
    }

    const channels = tables.map((table) =>
      supabase
        .channel(`live-refetch:${table}:${uid}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, fire)
        .subscribe(),
    )

    return () => {
      if (timer) clearTimeout(timer)
      channels.forEach((c) => void supabase.removeChannel(c))
    }
  }, [key, debounceMs])
}
