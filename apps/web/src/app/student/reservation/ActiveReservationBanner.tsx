'use client'

import { useEffect, useState } from 'react'

type Reservation = {
  id: string
  seat_id: string
  expires_at: string
  seats: { label: string } | null
}

export function ActiveReservationBanner({ reservation }: { reservation: Reservation }) {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    function update() {
      const diff = new Date(reservation.expires_at).getTime() - Date.now()
      if (diff <= 0) {
        setTimeLeft('Expirée')
        return
      }
      const m = Math.floor(diff / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`${m}m ${s.toString().padStart(2, '0')}s`)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [reservation.expires_at])

  return (
    <div className="rounded-xl bg-orange-50 border border-orange-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-orange-800">Réservation active</p>
          <p className="text-orange-700 text-sm">
            Place <strong>{reservation.seats?.label ?? '—'}</strong> — expire dans{' '}
            <strong>{timeLeft}</strong>
          </p>
        </div>
      </div>
      <p className="text-xs text-orange-600 mt-2">
        Présentez-vous et scannez votre QR code pour confirmer votre place.
        Les réservations ne peuvent pas être annulées manuellement.
      </p>
    </div>
  )
}
