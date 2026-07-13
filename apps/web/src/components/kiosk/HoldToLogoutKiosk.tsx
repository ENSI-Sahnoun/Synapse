'use client'

import { useCallback, useRef, useState } from 'react'
import { SignOut } from '@phosphor-icons/react'
import { signOutAction } from '@/data/auth/sign-out'

const HOLD_MS = 1500

export function HoldToLogoutKiosk() {
  const [progress, setProgress] = useState(0)
  const [loggingOut, setLoggingOut] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef = useRef<number>(0)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const cancelHold = useCallback(() => {
    clearTimer()
    setProgress(0)
  }, [clearTimer])

  const startHold = useCallback(() => {
    if (loggingOut) return
    startRef.current = Date.now()
    clearTimer()
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current
      const pct = Math.min(100, (elapsed / HOLD_MS) * 100)
      setProgress(pct)
      if (pct >= 100) {
        clearTimer()
        setLoggingOut(true)
        void signOutAction()
      }
    }, 16)
  }, [clearTimer, loggingOut])

  return (
    <div
      onPointerDown={startHold}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
      role="button"
      aria-label="Maintenir 1,5 seconde pour déconnecter le kiosque"
      title="Maintenir pour déconnecter"
      className="relative flex items-center justify-center rounded-full cursor-pointer select-none"
      style={{
        touchAction: 'none',
        width: 44,
        height: 44,
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.15)',
      }}
    >
      <svg width={44} height={44} viewBox="0 0 44 44" className="absolute -rotate-90">
        <circle cx={22} cy={22} r={19} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={3} />
        {progress > 0 && (
          <circle
            cx={22}
            cy={22}
            r={19}
            fill="none"
            stroke="#dc2626"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 19}
            strokeDashoffset={2 * Math.PI * 19 * (1 - progress / 100)}
          />
        )}
      </svg>
      <SignOut size={18} style={{ color: progress > 0 ? '#dc2626' : 'rgba(255,255,255,0.6)' }} />
    </div>
  )
}
