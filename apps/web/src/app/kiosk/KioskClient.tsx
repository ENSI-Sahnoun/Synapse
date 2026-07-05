'use client'

import { useState, useCallback } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { QrScanner } from '@/components/checkin/QrScanner'
import { KioskResult } from '@/components/kiosk/KioskResult'
import { KioskGuard } from '@/components/kiosk/KioskGuard'
import { KioskManualEntry } from '@/components/kiosk/KioskManualEntry'
import { KioskSeatPicker } from '@/components/kiosk/KioskSeatPicker'
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

type Mode = 'scanning' | 'selecting' | 'result'

export function KioskClient({ rooms }: { rooms: KioskRoom[] }) {
  const [mode, setMode] = useState<Mode>('scanning')
  const [scannerReady, setScannerReady] = useState(true)
  const [lastResult, setLastResult] = useState<CheckinResult | null>(null)

  const { execute } = useAction(checkinAction, {
    onSuccess: ({ data }) => {
      if (!data) return
      setLastResult(data)
      // Authorized walk-ins (no reserved seat) go straight to the seat picker.
      // Everyone else (reserved seat, or any denial) sees the result screen.
      if (data.status === 'AUTHORIZED' && !data.seatId) {
        setMode('selecting')
      } else {
        setMode('result')
      }
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

  // From the welcome screen a student with a reserved seat can change it.
  const handleChangeSeat = useCallback(() => setMode('selecting'), [])

  // Seat picker finished (assigned, changed, or skipped) → show welcome.
  const handlePickerDone = useCallback(() => setMode('result'), [])

  const authorized =
    lastResult?.status === 'AUTHORIZED' ? lastResult : null

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

      {mode === 'selecting' && authorized && (
        <KioskSeatPicker
          rooms={rooms}
          studentName={authorized.studentName}
          studentId={authorized.studentId}
          attendanceId={authorized.attendanceId}
          deferred={!!authorized.deferred}
          currentSeatId={authorized.seatId ?? null}
          onDone={handlePickerDone}
          // Walk-in who never chooses is NOT marked present → back to scanning.
          // A reserved student changing seats is already present → back to welcome.
          onTimeout={authorized.deferred ? handleReset : handlePickerDone}
        />
      )}

      {mode === 'result' && lastResult && (
        <div className="flex-1 flex items-center justify-center p-8">
          <KioskResult
            result={lastResult}
            onReset={handleReset}
            onChangeSeat={authorized?.seatId ? handleChangeSeat : undefined}
          />
        </div>
      )}
    </div>
  )
}
