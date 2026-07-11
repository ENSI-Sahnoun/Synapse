'use client'

import { useEffect, useState } from 'react'
import { QrCodeImage } from '@/components/student/QrCodeImage'
import type { KioskQrDrop } from '@/hooks/use-kiosk-qr-drop'

const COUNTDOWN_SECONDS = 30

export function KioskQrDisplay({ drop }: { drop: KioskQrDrop }) {
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS)

  useEffect(() => {
    setSecondsLeft(COUNTDOWN_SECONDS)
    const interval = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [drop.id])

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
      <p className="text-gray-300 text-2xl uppercase tracking-widest text-center">
        {drop.studentName}
      </p>
      <div className="bg-white p-6 rounded-2xl shadow-lg">
        <QrCodeImage token={drop.qrToken} size={320} />
      </div>
      <p className="text-gray-500 text-sm">
        Scannez ce code avec votre téléphone
      </p>
      <p className="text-gray-600 text-xs">
        Cette diffusion expire dans {secondsLeft}s
      </p>
    </div>
  )
}
