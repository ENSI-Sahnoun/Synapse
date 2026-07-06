'use client'

import { useEffect, useState } from 'react'

// Temporary on-screen error catcher for debugging on devices without remote
// inspector access (e.g. iPhone without a Mac). Renders nothing unless an
// error actually fires. Remove once the splash issue is diagnosed.
export function DebugErrorOverlay() {
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      setErrors((prev) => [...prev, `${e.message} @ ${e.filename}:${e.lineno}`])
    }
    const onRejection = (e: PromiseRejectionEvent) => {
      setErrors((prev) => [...prev, `unhandled rejection: ${String(e.reason)}`])
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  if (errors.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(0,0,0,0.9)',
        color: '#fff',
        fontSize: 12,
        padding: 12,
        overflow: 'auto',
        fontFamily: 'monospace',
      }}
    >
      {errors.map((err, i) => (
        <div key={i} style={{ marginBottom: 8, whiteSpace: 'pre-wrap' }}>
          {err}
        </div>
      ))}
    </div>
  )
}
