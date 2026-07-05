'use client'

import { useState, useCallback } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { QrScanner } from '@/components/checkin/QrScanner'
import { KioskResult } from '@/components/kiosk/KioskResult'
import { KioskGuard } from '@/components/kiosk/KioskGuard'
import { KioskManualEntry } from '@/components/kiosk/KioskManualEntry'
import { checkinAction } from '@/actions/checkin/checkin-action'
import type { CheckinResult } from '@/utils/zod-schemas/checkin'
import type { RoomTable, Seat } from '@/data/admin/seat-map'

export type KioskRoom = {
  id: string
  name: string
  status: string
  status_note: string | null
  tables: RoomTable[]
  seats: Seat[]
}

type Mode = 'scanning' | 'result'

export function KioskClient({ rooms: _rooms }: { rooms: KioskRoom[] }) {
  const [mode, setMode] = useState<Mode>('scanning')
  const [scannerReady, setScannerReady] = useState(true)
  const [lastResult, setLastResult] = useState<CheckinResult | null>(null)

  const { execute } = useAction(checkinAction, {
    onSuccess: ({ data }) => {
      if (!data) return
      setLastResult(data)
      // Every scan now goes straight to the welcome / result screen. Seat
      // choice happens on the student's own phone, not at the kiosk.
      setMode('result')
    },
    onError: () => {
      setLastResult({ status: 'DENIED_UNKNOWN' })
      setMode('result')
    },
  })

  const handleScan = useCallback(
    (token: string) => {
      if (!scannerReady) return
      setScannerReady(false)
      execute({ qrToken: token })
    },
    [scannerReady, execute]
  )

  const handleReset = useCallback(() => {
    setLastResult(null)
    setScannerReady(true)
    setMode('scanning')
  }, [])

  return (
    <div className="w-screen h-screen bg-black text-white flex flex-col">
      <KioskGuard />

      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-800 shrink-0">
        <span className="text-xl font-bold tracking-widest">SYNAPSE</span>
        <span className="text-gray-500 text-sm">Kiosque d&apos;accès</span>
      </div>

      {mode === 'scanning' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
          <p className="text-gray-300 text-2xl uppercase tracking-widest">
            Présentez votre QR code
          </p>
          <div className="w-full max-w-2xl">
            <QrScanner onScan={handleScan} ready={scannerReady} />
          </div>
          <p className="text-gray-600 text-sm">
            Ouvrez l&apos;app Synapse → QR Code
          </p>
          <KioskManualEntry onSubmit={handleScan} disabled={!scannerReady} />
        </div>
      )}

      {mode === 'result' && lastResult && (
        <div className="flex-1 flex items-center justify-center p-8">
          <KioskResult result={lastResult} onReset={handleReset} />
        </div>
      )}
    </div>
  )
}
