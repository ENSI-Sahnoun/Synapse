'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

const WARNING_THRESHOLD_MS = 2 * 60 * 1000

type Reservation = {
  id: string
  seat_id: string
  expires_at: string
  queue_position: number | null
  seats: { label: string } | null
}

export function ActiveReservationBanner({
  reservation,
  examMode,
}: {
  reservation: Reservation
  examMode: boolean
}) {
  const [timeLeft, setTimeLeft] = useState('')
  const [urgent, setUrgent] = useState(false)
  const warnedRef = useRef(false)

  useEffect(() => {
    function update() {
      const diff = new Date(reservation.expires_at).getTime() - Date.now()
      if (diff <= 0) {
        setTimeLeft('Expirée')
        setUrgent(true)
        return
      }
      if (diff <= WARNING_THRESHOLD_MS) {
        setUrgent(true)
        if (!warnedRef.current) {
          warnedRef.current = true
          toast.warning(`Votre réservation expire bientôt — place ${reservation.seats?.label ?? '—'}`, {
            position: 'top-center',
          })
        }
      }
      const m = Math.floor(diff / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`${m}m ${s.toString().padStart(2, '0')}s`)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [reservation.expires_at, reservation.seats?.label])

  return (
    <div
      className={
        urgent
          ? 'rounded-xl bg-red-50 border border-red-300 p-4 animate-pulse'
          : 'rounded-xl bg-orange-50 border border-orange-200 p-4'
      }
    >
      <div className="flex items-center justify-between">
        <div>
          <p className={urgent ? 'font-semibold text-red-800' : 'font-semibold text-orange-800'}>Réservation active</p>
          <p className={urgent ? 'text-red-700 text-sm' : 'text-orange-700 text-sm'}>
            Place <strong>{reservation.seats?.label ?? '—'}</strong> — expire dans{' '}
            <strong>{timeLeft}</strong>
          </p>
        </div>
      </div>
      {examMode && reservation.queue_position != null && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-800 mt-2">
          Position dans la file d'attente :{' '}
          <strong className="text-blue-900 text-base">#{reservation.queue_position}</strong>
        </div>
      )}
      <p className="text-xs text-orange-600 mt-2">
        {examMode
          ? "Mode examen — présentez-vous dans l'ordre de la file pour valider votre entrée."
          : 'Présentez-vous et scannez votre QR code pour confirmer votre place.'}
        {' '}Les réservations ne peuvent pas être annulées manuellement.
      </p>
    </div>
  )
}
