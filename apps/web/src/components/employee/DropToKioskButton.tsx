'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { dropQrToKiosk, cancelKioskQrDrop } from '@/actions/employee/kiosk-qr-drop'

const BROADCAST_SECONDS = 30

export function DropToKioskButton({ studentId }: { studentId: string }) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  function startCountdown() {
    setSecondsLeft(BROADCAST_SECONDS)
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s === null || s <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          return null
        }
        return s - 1
      })
    }, 1000)
  }

  function stopCountdown() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setSecondsLeft(null)
  }

  async function handleClick() {
    if (isBusy) return
    setIsBusy(true)
    try {
      if (secondsLeft !== null) {
        const result = await cancelKioskQrDrop({ studentId })
        if (result?.serverError) {
          toast.error(result.serverError)
        } else {
          stopCountdown()
        }
      } else {
        const result = await dropQrToKiosk({ studentId })
        if (result?.serverError) {
          toast.error(result.serverError)
        } else {
          startCountdown()
        }
      }
    } finally {
      setIsBusy(false)
    }
  }

  const isBroadcasting = secondsLeft !== null

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isBusy}
      className="px-4 py-2 rounded-md text-sm font-semibold print:hidden disabled:opacity-60"
      style={{
        background: isBroadcasting ? 'var(--destructive)' : 'var(--accent-brand)',
        color: 'white',
      }}
    >
      {isBroadcasting ? `Diffusion en cours (${secondsLeft}s) — Arrêter` : 'Envoyer au kiosque'}
    </button>
  )
}
