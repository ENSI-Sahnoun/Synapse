'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { PaperPlaneTilt, Check } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { airdropQrCode } from '@/actions/student/airdrop-qr'
import { QrCodeImage } from '@/components/student/QrCodeImage'

const HOLD_MS = 700
const COOLDOWN_MS = 10_000

interface HoldToSendQrProps {
  token: string
  size?: number
}

export function HoldToSendQr({ token, size = 280 }: HoldToSendQrProps) {
  const [progress, setProgress] = useState(0)
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startRef = useRef<number>(0)
  // The hold interval resolves a server action, so state updates can land after
  // the user has navigated away — every setState below is gated on this.
  const mountedRef = useRef(true)
  const reduceMotion = useReducedMotion()

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (timerRef.current) clearInterval(timerRef.current)
      if (cooldownRef.current) clearTimeout(cooldownRef.current)
    }
  }, [])

  const cancelHold = useCallback(() => {
    clearTimer()
    setProgress(0)
  }, [clearTimer])

  const startHold = useCallback(() => {
    if (sending || sent) return
    startRef.current = Date.now()
    clearTimer()
    timerRef.current = setInterval(async () => {
      const elapsed = Date.now() - startRef.current
      const pct = Math.min(100, (elapsed / HOLD_MS) * 100)
      setProgress(pct)
      if (pct >= 100) {
        clearTimer()
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          navigator.vibrate(20)
        }
        setSending(true)
        const result = await airdropQrCode({})
        if (!mountedRef.current) return
        setSending(false)
        if (result?.serverError) {
          toast.error(result.serverError)
          setProgress(0)
          return
        }
        setSent(true)
        toast.success('Code envoyé au personnel.')
        if (cooldownRef.current) clearTimeout(cooldownRef.current)
        cooldownRef.current = setTimeout(() => {
          if (!mountedRef.current) return
          setSent(false)
          setProgress(0)
        }, COOLDOWN_MS)
      }
    }, 16)
  }, [clearTimer, sending, sent])

  // Keyboard equivalent of the press-and-hold gesture (WCAG 2.1.1): holding
  // Enter/Space fills the same ring, releasing before 100% cancels it.
  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      if (e.repeat) return
      startHold()
    },
    [startHold],
  )

  const onKeyUp = useCallback(
    (e: ReactKeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      cancelHold()
    },
    [cancelHold],
  )

  return (
    <div className="relative select-none" style={{ touchAction: 'none' }}>
      <motion.div
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onBlur={cancelHold}
        animate={sent && !reduceMotion ? { scale: [1, 1.04, 1] } : { scale: 1 }}
        transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
        className="relative bg-white p-4 rounded-2xl shadow-lg max-w-full cursor-pointer"
        role="button"
        tabIndex={0}
        aria-label="Maintenir pour envoyer le code au personnel"
        title="Maintenir pour envoyer le code au personnel"
      >
        <QrCodeImage token={token} size={size} />

        {(progress > 0 || sending || sent) && (
          <div
            className="absolute inset-0 flex items-center justify-center rounded-2xl transition-opacity"
            style={{ background: 'rgba(255,255,255,0.85)' }}
          >
            {sent ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                className="flex flex-col items-center gap-1"
                style={{ color: 'var(--synapse-green-700)' }}
              >
                <Check size={32} weight="bold" />
                <span className="text-xs font-semibold">Envoyé</span>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center gap-2" style={{ color: 'var(--synapse-brown-600)' }}>
                <div className="relative flex items-center justify-center" style={{ width: 48, height: 48 }}>
                  <svg width={48} height={48} viewBox="0 0 48 48" className="-rotate-90">
                    <circle cx={24} cy={24} r={20} fill="none" stroke="var(--synapse-cream-200)" strokeWidth={4} />
                    <circle
                      cx={24}
                      cy={24}
                      r={20}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={4}
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 20}
                      strokeDashoffset={2 * Math.PI * 20 * (1 - progress / 100)}
                    />
                  </svg>
                  <PaperPlaneTilt size={18} weight="bold" className="absolute" />
                </div>
                <span className="text-xs font-semibold">Maintenir pour envoyer</span>
              </div>
            )}
          </div>
        )}
      </motion.div>
      <p className="text-[11px] text-center mt-2" style={{ color: 'var(--muted-foreground)' }}>
        Maintenez le QR pour l'envoyer au personnel
      </p>
    </div>
  )
}
