'use client'

import { useEffect, useRef, useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Armchair, ArrowCounterClockwise, CircleNotch } from '@phosphor-icons/react'
import { moveSelfToDivers, undoMoveSelfToDivers, checkOutSelf } from '@/actions/student/seat-swap'
import type { MyPresence } from '@/data/student/profile'

const UNDO_WINDOW_MS = 60_000

export function PresenceBanner({ presence }: { presence: MyPresence }) {
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const [undoInfo, setUndoInfo] = useState<{ seatId: string; roomId: string } | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current)
    }
  }, [])

  const { execute: moveToDivers, status: moveStatus } = useAction(moveSelfToDivers, {
    onSuccess: ({ data }) => {
      if (data?.seatId && data.roomId) {
        setUndoInfo({ seatId: data.seatId, roomId: data.roomId })
        toast.success('Vous êtes maintenant en Divers')
        if (undoTimer.current) clearTimeout(undoTimer.current)
        undoTimer.current = setTimeout(() => setUndoInfo(null), UNDO_WINDOW_MS)
      }
      router.refresh()
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  const { execute: undo, status: undoStatus } = useAction(undoMoveSelfToDivers, {
    onSuccess: () => {
      toast.success('Place reprise')
      if (undoTimer.current) clearTimeout(undoTimer.current)
      setUndoInfo(null)
      router.refresh()
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'Erreur')
      setUndoInfo(null)
    },
  })

  const [confirmCheckout, setConfirmCheckout] = useState(false)
  const { execute: checkOut, status: checkOutStatus } = useAction(checkOutSelf, {
    onSuccess: () => {
      toast.success('Sortie enregistrée')
      setConfirmCheckout(false)
      router.refresh()
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'Erreur')
      setConfirmCheckout(false)
    },
  })

  const isAbsent = presence.status === 'absent'
  const bg = isAbsent ? 'var(--synapse-cream-100)' : 'var(--synapse-green-50, #edfaf4)'
  const border = isAbsent ? 'var(--border-default)' : 'var(--synapse-green-200, #bbf7d0)'
  const iconBg = isAbsent ? 'var(--synapse-cream-200)' : 'var(--synapse-green-100, #dcfce7)'
  const labelColor = isAbsent ? 'var(--muted-foreground)' : 'var(--synapse-green-600, #16a34a)'
  const valueColor = isAbsent ? 'var(--text-secondary)' : 'var(--synapse-green-800, #166534)'

  const isMoving = moveStatus === 'executing'
  const isCheckingOut = checkOutStatus === 'executing'
  const isUndoing = undoStatus === 'executing'

  // Height collapse reads as the row growing out of the banner; under reduced
  // motion it degrades to a plain cross-fade.
  const reveal = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, height: 0 },
        animate: { opacity: 1, height: 'auto' as const },
        exit: { opacity: 0, height: 0 },
      }
  const revealTransition = { duration: 0.22, ease: [0.23, 1, 0.32, 1] as const }

  return (
    <div className="space-y-2">
      <div
        className="rounded-xl flex items-center gap-3 px-4 py-3"
        style={{ background: bg, border: `1px solid ${border}` }}
      >
        <div
          className="flex-shrink-0 flex items-center justify-center rounded-xl"
          style={{ width: 40, height: 40, background: iconBg }}
        >
          <Armchair size={20} weight="duotone" style={{ color: labelColor }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: labelColor }}>
            Présent
          </p>
          <p className="text-base font-bold leading-tight" style={{ fontFamily: 'var(--font-display)', color: valueColor }}>
            {presence.status === 'seated' ? (
              <>
                Place {presence.label}
                {presence.room && (
                  <span className="text-sm font-medium" style={{ color: labelColor }}>
                    {' '}· {presence.room}
                  </span>
                )}
              </>
            ) : presence.status === 'divers' ? (
              'Divers'
            ) : (
              'Absent'
            )}
          </p>
        </div>
        {presence.status === 'seated' && (
          <button
            onClick={() => moveToDivers({})}
            disabled={isMoving}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 min-h-[44px] rounded-lg border disabled:opacity-60"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}
          >
            {isMoving && <CircleNotch size={14} weight="bold" className="animate-spin" />}
            {isMoving ? 'Déplacement…' : 'Passer en Divers'}
          </button>
        )}
      </div>

      {(presence.status === 'seated' || presence.status === 'divers') && (
        <AnimatePresence initial={false} mode="wait">
          {confirmCheckout ? (
            <motion.div key="confirm" {...reveal} transition={revealTransition} className="overflow-hidden">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium flex-1" style={{ color: 'var(--text-secondary)' }}>
                  Confirmer la sortie ?
                </span>
                <button
                  onClick={() => setConfirmCheckout(false)}
                  disabled={isCheckingOut}
                  className="text-sm font-semibold px-3 min-h-[44px] rounded-lg border disabled:opacity-60"
                  style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                >
                  Annuler
                </button>
                <button
                  onClick={() => checkOut({})}
                  disabled={isCheckingOut}
                  className="flex items-center gap-1.5 text-sm font-semibold px-3 min-h-[44px] rounded-lg disabled:opacity-60"
                  style={{ background: 'var(--accent-brand)', color: '#fff' }}
                >
                  {isCheckingOut && <CircleNotch size={14} weight="bold" className="animate-spin" />}
                  {isCheckingOut ? 'Sortie…' : 'Sortir'}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="terminate" {...reveal} transition={revealTransition} className="overflow-hidden">
              <button
                onClick={() => setConfirmCheckout(true)}
                className="w-full text-sm font-semibold px-3 py-2.5 min-h-[44px] rounded-lg border"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
              >
                Terminer ma session
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <AnimatePresence initial={false}>
        {undoInfo && (
          <motion.div key="undo" {...reveal} transition={revealTransition} className="overflow-hidden">
            <button
              onClick={() => undo(undoInfo)}
              disabled={isUndoing}
              className="w-full flex items-center justify-center gap-2 text-sm font-semibold px-3 py-2.5 min-h-[44px] rounded-lg border disabled:opacity-60"
              style={{ borderColor: 'var(--border-default)', color: 'var(--accent-brand)' }}
            >
              {isUndoing ? (
                <CircleNotch size={14} weight="bold" className="animate-spin" />
              ) : (
                <ArrowCounterClockwise size={14} />
              )}
              {isUndoing ? 'Reprise…' : 'Annuler — reprendre ma place'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
