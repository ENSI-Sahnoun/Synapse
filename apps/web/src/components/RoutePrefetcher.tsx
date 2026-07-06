'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Warms the Next.js Router Cache for a role's top-level routes on first load,
// so tab-to-tab navigation is instant (page already fetched + rendered).
//
// Fires immediately on mount (alongside the splash screen) rather than on
// requestIdleCallback: the splash's fixed display window is the only time
// budget these prefetches get, and idle callbacks can be pushed back by the
// splash's own animation frames, eating into that budget before any fetch
// even starts.
//
// kind: 'full' is required here — these routes are dynamic (per-request DB
// fetches), and the default 'auto' kind only prefetches the static shell for
// dynamic pages, skipping the actual data fetch entirely.
export function RoutePrefetcher({ routes }: { routes: string[] }) {
  const router = useRouter()

  useEffect(() => {
    for (const route of routes) router.prefetch(route, { kind: 'full' } as never)
  }, [routes, router])

  return null
}
