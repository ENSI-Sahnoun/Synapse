'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/supabase-clients/client'

export function useLiveRows<T extends Record<string, unknown>>(opts: {
  table: string
  filter?: string
  initial: T[]
  primaryKey?: string
}): T[] {
  const { table, filter, initial, primaryKey = 'id' } = opts
  const [rows, setRows] = useState<T[]>(initial)

  // Re-sync when the server sends new initial data (e.g. after navigation).
  useEffect(() => { setRows(initial) }, [initial])

  useEffect(() => {
    const supabase = createClient()
    const uid = Math.random().toString(36).slice(2, 7)
    const channel = supabase
      .channel(`live-rows:${table}:${filter ?? 'all'}:${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) },
        (payload) => {
          setRows((prev) => {
            if (payload.eventType === 'INSERT') {
              const row = payload.new as T
              if (prev.some((r) => r[primaryKey] === row[primaryKey])) return prev
              return [...prev, row]
            }
            if (payload.eventType === 'UPDATE') {
              const row = payload.new as T
              return prev.map((r) => (r[primaryKey] === row[primaryKey] ? row : r))
            }
            // DELETE
            const old = payload.old as T
            return prev.filter((r) => r[primaryKey] !== old[primaryKey])
          })
        },
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [table, filter, primaryKey])

  return rows
}
