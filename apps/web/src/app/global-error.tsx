'use client'

import { useEffect } from 'react'

/**
 * Last-resort boundary — catches errors thrown by the root layout itself, so it
 * must render its own <html>/<body> (it replaces the root layout). Kept
 * dependency-free (no shared UI) so it can't itself fail to render.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="fr">
      <body style={{ fontFamily: "'DM Sans', system-ui, sans-serif", margin: 0 }}>
        <div
          style={{
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: 24,
            textAlign: 'center',
            background: '#FAF7F0',
            color: '#1D0F07',
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Une erreur est survenue</h2>
          <p style={{ fontSize: 14, color: '#665C54', maxWidth: 360, margin: 0 }}>
            L&apos;application a rencontré un problème inattendu. Veuillez réessayer.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 4,
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: '#A2724A',
              color: '#fff',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  )
}
