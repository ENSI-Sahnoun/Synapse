'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Armchair, X } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

// Shown to a student who is checked in but has no seat ("Divers"). Nudges them
// to pick a seat. Dismissing it ("Plus tard") suppresses it for the rest of
// THIS check-in via sessionStorage keyed by attendanceId — it reappears on the
// next check-in (new attendance id), not on every page load.
const dismissKey = (attendanceId: string) => `divers-dismissed:${attendanceId}`

export function DiversSeatPrompt({ attendanceId }: { attendanceId: string }) {
  // Start closed to avoid a flash before we read sessionStorage on mount.
  const [open, setOpen] = useState(false)
  const reducedMotion = useReducedMotion()

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
            // Tween on --ease-drawer rather than a spring: the old 380/30 spring
            // (zeta ~0.77) visibly overshot on a sheet this size.
            initial={reducedMotion ? { opacity: 0 } : { y: 40, opacity: 0, scale: 0.97 }}
            animate={reducedMotion ? { opacity: 1 } : { y: 0, opacity: 1, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { y: 40, opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={dismiss}
              aria-label="Fermer"
              className="absolute right-2 top-2 size-11 text-gray-400 hover:text-gray-600"
            >
              <X size={20} weight="bold" />
            </Button>

            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--synapse-green-50)]">
              <Armchair size={28} weight="duotone" className="text-[var(--synapse-green-500)]" />
            </div>

            <h3 className="text-lg font-bold text-gray-900">Vous avez fait votre choix ?</h3>
            <p className="mt-1 text-sm text-gray-600">
              Vous êtes enregistré comme présent mais sans place attribuée. Choisissez
              où vous asseoir dès maintenant.
            </p>

            <div className="mt-5 flex gap-3">
              <Button variant="outline" onClick={dismiss} className="min-h-11 flex-1">
                Plus tard
              </Button>
              <Button
                asChild
                className="min-h-11 flex-1 bg-[var(--synapse-green-600)] font-semibold text-white hover:bg-[var(--synapse-green-700)]"
              >
                <Link href="/student/rooms">Choisir ma place</Link>
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
