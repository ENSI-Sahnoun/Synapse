'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Shared recovery UI for App Router error.tsx boundaries. A thrown error in any
 * server component (a transient Supabase/RLS failure, a timeout) renders this
 * instead of Next's default white screen, with a reset() retry.
 */
export function RouteError({
  error,
  reset,
  label = 'cette page',
}: {
  error: Error & { digest?: string }
  reset: () => void
  label?: string
}) {
  useEffect(() => {
    // Log so a transient failure is diagnosable (and reachable by any reporter).
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-7" aria-hidden />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold text-foreground">Une erreur est survenue</h2>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          Impossible de charger {label}. Le problème est peut-être temporaire.
        </p>
      </div>
      <Button onClick={reset}>Réessayer</Button>
    </div>
  )
}
