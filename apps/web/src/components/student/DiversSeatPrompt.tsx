'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Armchair, X } from '@phosphor-icons/react'

// Shown to a student who is checked in but has no seat ("Divers") — typically
// because they tapped "je choisirai plus tard" at the kiosk. Nudges them to
// pick a seat now. Dismissible; reappears on next load while still seatless.
export function DiversSeatPrompt() {
  const [open, setOpen] = useState(true)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <button
          onClick={() => setOpen(false)}
          aria-label="Fermer"
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
        >
          <X size={20} weight="bold" />
        </button>

        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--synapse-green-50)]">
          <Armchair size={28} weight="duotone" className="text-[var(--synapse-green-500)]" />
        </div>

        <h3 className="text-lg font-bold text-gray-900">Vous avez fait votre choix ?</h3>
        <p className="mt-1 text-sm text-gray-600">
          Vous êtes enregistré comme présent mais sans place attribuée. Choisissez
          où vous asseoir dès maintenant.
        </p>

        <div className="mt-5 flex gap-3">
          <button
            onClick={() => setOpen(false)}
            className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700"
          >
            Plus tard
          </button>
          <Link
            href="/student/reservation"
            className="flex-1 rounded-lg bg-[var(--synapse-green-500)] py-2.5 text-center text-sm font-semibold text-white"
          >
            Choisir ma place
          </Link>
        </div>
      </div>
    </div>
  )
}
