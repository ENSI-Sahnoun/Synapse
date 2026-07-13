'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useLiveRefetch } from '@/hooks/use-live-refetch'
import { waitForSplashEnd } from '@/components/student/StudentSplash'
import {
  getUnseenCelebrationAction,
  markCelebrationsSeenAction,
  type CelebrationEvent,
} from '@/actions/student/celebrations'

const CONFETTI_COLORS = ['#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899']
const CONFETTI_COUNT = 40
const AUTO_DISMISS_MS = 6000

const KIND_META: Record<CelebrationEvent['kind'], { emoji: string; title: string }> = {
  purchase: { emoji: '🎉', title: 'Merci pour votre achat !' },
  subscription: { emoji: '🚀', title: 'Abonnement activé !' },
  locker: { emoji: '🔐', title: 'Casier attribué !' },
}

function ConfettiPiece({ index }: { index: number }) {
  const left = (index * 97) % 100
  const delay = ((index * 37) % 100) / 100
  const duration = 2.4 + ((index * 53) % 100) / 60
  const size = 6 + ((index * 29) % 8)
  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length]
  return (
    <motion.div
      initial={{ y: '-10vh', opacity: 1, rotate: 0 }}
      animate={{ y: '110vh', opacity: [1, 1, 0.6], rotate: 360 + ((index * 71) % 360) }}
      transition={{ duration, delay, ease: 'linear', repeat: Infinity }}
      style={{
        position: 'absolute',
        top: 0,
        left: `${left}%`,
        width: size,
        height: size * 0.5,
        borderRadius: 2,
        backgroundColor: color,
        willChange: 'transform',
      }}
    />
  )
}

function PointsCounter({ points, delayMs = 0 }: { points: number; delayMs?: number }) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    const start = performance.now() + delayMs
    const durationMs = 650
    let raf: number
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / durationMs))
      setValue(Math.round(points * (1 - Math.pow(1 - t, 3))))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [points, delayMs])
  return <span>{value}</span>
}

export function CelebrationPopup() {
  const [event, setEvent] = useState<CelebrationEvent | null>(null)
  const shownRef = useRef(false) // never re-queue in one session, even if mark fails
  const reduceMotion = useReducedMotion()

  const openIfAny = useCallback(async () => {
    if (shownRef.current) return
    try {
      const res = await getUnseenCelebrationAction()
      const payload = res?.data ?? null
      if (payload && payload.id) {
        shownRef.current = true
        await waitForSplashEnd()
        setEvent(payload)
      }
    } catch {
      // best-effort: never break the page
    }
  }, [])

  const dismiss = useCallback(() => {
    setEvent(null)
    markCelebrationsSeenAction().catch(() => {})
  }, [])

  // Catch-up on app open.
  useEffect(() => { void openIfAny() }, [openIfAny])

  // Instant popup while the app is open. Unfiltered subscription matches the
  // proven useLiveRefetch pattern; RLS scopes delivery to own rows and the
  // fetch action re-checks server-side anyway.
  useLiveRefetch(['celebration_events'], () => {
    shownRef.current = false // new event: allowed to show again
    void openIfAny()
  }, { debounceMs: 100 })

  // Auto-dismiss.
  useEffect(() => {
    if (!event) return
    const t = setTimeout(dismiss, AUTO_DISMISS_MS)
    return () => clearTimeout(t)
  }, [event, dismiss])

  if (!event) return <AnimatePresence />

  const meta = KIND_META[event.kind] ?? KIND_META.purchase
  const items = event.kind === 'purchase' ? event.payload.items ?? [] : []
  const detailLines: string[] = []
  if (event.kind === 'subscription' && event.payload.plan_name) {
    detailLines.push(event.payload.plan_name)
  }
  if (event.kind === 'locker' && event.payload.locker_number != null) {
    detailLines.push(`Casier n° ${event.payload.locker_number}`)
  }
  const showPoints = event.points > 0
  const pointsDelay = 0.12 + (items.length + detailLines.length) * 0.06 + 0.15

  return (
    <AnimatePresence>
      <motion.div
        key="celebration-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={dismiss}
        role="dialog"
        aria-label={meta.title}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          backgroundColor: 'rgba(0,0,0,0.55)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        {!reduceMotion &&
          Array.from({ length: CONFETTI_COUNT }, (_, i) => <ConfettiPiece key={i} index={i} />)}

        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { scale: 0.6, y: 60, opacity: 0 }}
          animate={reduceMotion ? { opacity: 1 } : { scale: 1, y: 0, opacity: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 420, damping: 28, mass: 0.7 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-2xl p-6 text-center shadow-xl"
          style={{ backgroundColor: 'var(--surface, #fff)' }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.05, type: 'spring', stiffness: 420, damping: 16 }}
            className="text-4xl"
            aria-hidden
          >
            {meta.emoji}
          </motion.div>
          <h2 className="mt-2 text-lg font-semibold">{meta.title}</h2>

          {(items.length > 0 || detailLines.length > 0) && (
            <ul className="mt-4 space-y-1 text-sm">
              {items.map((item, i) => (
                <motion.li
                  key={`${item.name}-${i}`}
                  initial={reduceMotion ? false : { opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.12 + i * 0.06, duration: 0.25 }}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image_url}
                        alt=""
                        className="w-6 h-6 rounded-md object-cover flex-shrink-0"
                      />
                    ) : (
                      <span
                        className="w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center text-xs"
                        style={{ background: 'var(--synapse-cream-100)' }}
                        aria-hidden
                      >
                        🛍️
                      </span>
                    )}
                    <span className="truncate">{item.name}</span>
                  </span>
                  <span className="flex-shrink-0">×{item.quantity}</span>
                </motion.li>
              ))}
              {detailLines.map((line, i) => (
                <motion.li
                  key={line}
                  initial={reduceMotion ? false : { opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.12 + (items.length + i) * 0.06, duration: 0.25 }}
                >
                  {line}
                </motion.li>
              ))}
            </ul>
          )}

          {showPoints && (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: reduceMotion ? 1 : [0.5, 1.15, 1] }}
              transition={{ delay: pointsDelay, duration: 0.35 }}
              className="mt-5 rounded-xl py-3 font-semibold"
              style={{ backgroundColor: 'var(--synapse-brown-100)', color: 'var(--accent-brand)' }}
            >
              +<PointsCounter points={event.points} delayMs={reduceMotion ? 0 : pointsDelay * 1000} /> point(s) Synapse ✨
            </motion.div>
          )}

          <button
            onClick={dismiss}
            className="mt-5 w-full rounded-lg py-2 text-sm font-medium"
            style={{ backgroundColor: 'var(--accent-brand)', color: '#fff' }}
          >
            Fermer
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
