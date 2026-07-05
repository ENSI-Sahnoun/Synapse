'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { Armchair, X } from '@phosphor-icons/react'

// Shown to a student who is checked in but has no seat ("Divers"). Nudges them
// to pick a seat. Dismissing it ("Plus tard") suppresses it for the rest of
// THIS check-in via sessionStorage keyed by attendanceId — it reappears on the
// next check-in (new attendance id), not on every page load.
const dismissKey = (attendanceId: string) => `divers-dismissed:${attendanceId}`

export function DiversSeatPrompt({ attendanceId }: { attendanceId: string }) {
  // Start closed to avoid a flash before we read sessionStorage on mount.
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!sessionStorage.getItem(dismissKey(attendanceId))) setOpen(true)
  }, [attendanceId])

  const dismiss = () => {
    sessionStorage.setItem(dismissKey(attendanceId), '1')
    setOpen(false)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={dismiss}
        >
          <motion.div
            className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            initial={{ y: 40, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={dismiss}
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
                onClick={dismiss}
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
