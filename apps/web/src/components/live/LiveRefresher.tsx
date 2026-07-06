'use client'

import { useRouter } from 'next/navigation'
import { useLiveRefetch } from '@/hooks/use-live-refetch'

/**
 * Drop into any server-component page to make it live: re-runs the server
 * render (router.refresh) whenever any listed table changes. Renders nothing.
 */
export function LiveRefresher({ tables }: { tables: string[] }) {
  const router = useRouter()
  useLiveRefetch(tables, () => router.refresh())
  return null
}
