'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Warms the Next.js Router Cache for a role's top-level routes on first load,
// so tab-to-tab navigation is instant (page already fetched + rendered). Runs
// during idle time so it never competes with the initial page render.
export function RoutePrefetcher({ routes }: { routes: string[] }) {
  const router = useRouter()

  useEffect(() => {
    const idle: (cb: () => void) => number =
      (window as unknown as { requestIdleCallback?: typeof window.setTimeout })
        .requestIdleCallback ?? ((cb) => window.setTimeout(cb, 200))

    const handle = idle(() => {
      for (const route of routes) router.prefetch(route)
    })

    return () => {
      const cancel = (window as unknown as { cancelIdleCallback?: (h: number) => void })
        .cancelIdleCallback
      if (cancel) cancel(handle)
      else clearTimeout(handle)
    }
  }, [routes, router])

  return null
}
