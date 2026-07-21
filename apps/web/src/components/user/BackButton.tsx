'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export function BackButton({ fallbackHref = '/student/dashboard' }: { fallbackHref?: string }) {
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          router.back()
        } else {
          router.push(fallbackHref)
        }
      }}
      aria-label="Retour"
      className="inline-flex items-center gap-1.5 text-sm font-semibold rounded-full pl-2 pr-3 py-1.5 -ml-2 active:scale-95 transition-transform"
      style={{ color: 'var(--text-brand)' }}
    >
      <ArrowLeft className="h-4 w-4" />
      Retour
    </button>
  )
}
