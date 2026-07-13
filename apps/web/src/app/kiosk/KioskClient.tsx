'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { ArrowsClockwise } from '@phosphor-icons/react'
import { QrScanner } from '@/components/checkin/QrScanner'
import { KioskResult } from '@/components/kiosk/KioskResult'
import { KioskGuard } from '@/components/kiosk/KioskGuard'
import { KioskManualEntry } from '@/components/kiosk/KioskManualEntry'
import { KioskQrDisplay } from '@/components/kiosk/KioskQrDisplay'
import { HoldToLogoutKiosk } from '@/components/kiosk/HoldToLogoutKiosk'
import { useKioskQrDrop } from '@/hooks/use-kiosk-qr-drop'
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

type Mode = 'scanning' | 'result' | 'qr-display'
type Rotation = 0 | 90 | 180 | 270

const ROTATION_KEY = 'kiosk-screen-rotation'

export function KioskClient({ rooms: _rooms }: { rooms: KioskRoom[] }) {
  const [mode, setMode] = useState<Mode>('scanning')
  const [scannerReady, setScannerReady] = useState(true)
  const [lastResult, setLastResult] = useState<CheckinResult | null>(null)
  const [rotation, setRotation] = useState<Rotation>(0)
  const { drop } = useKioskQrDrop()

  // Some kiosk tablets/webviews don't honor the manifest's landscape lock or
  // the device's physical orientation change — this lets staff force the
  // screen orientation manually. Persisted so it survives PWA restarts.
  useEffect(() => {
    const saved = Number(localStorage.getItem(ROTATION_KEY))
    if ([0, 90, 180, 270].includes(saved)) setRotation(saved as Rotation)
  }, [])

  const cycleRotation = useCallback(() => {
    setRotation((prev) => {
      const next = ((prev + 90) % 360) as Rotation
      localStorage.setItem(ROTATION_KEY, String(next))
      return next
    })
  }, [])

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

  // A drop only interrupts the idle scanning screen, never a check-in result
  // already on screen — that would yank the welcome message away from a
  // student mid check-in. Once staff resets back to 'scanning' (handleReset)
  // and a drop is still active, this effect switches to it then.
  useEffect(() => {
    if (drop && mode === 'scanning') {
      setMode('qr-display')
    } else if (!drop && mode === 'qr-display') {
      setScannerReady(true)
      setMode('scanning')
    }
  }, [drop, mode])

  const rotated = rotation === 90 || rotation === 270

  return (
    <div
      className="fixed bg-black text-white flex flex-col"
      style={{
        top: '50%',
        left: '50%',
        width: rotated ? '100vh' : '100vw',
        height: rotated ? '100vw' : '100vh',
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
      }}
    >
      <KioskGuard />

      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-800 shrink-0">
        <span className="text-xl font-bold tracking-widest">SYNAPSE</span>
        <div className="flex items-center gap-3">
          <span className="text-gray-500 text-sm">Kiosque d&apos;accès</span>
          <button
            type="button"
            onClick={cycleRotation}
            aria-label="Pivoter l'écran"
            title="Pivoter l'écran"
            className="flex items-center justify-center rounded-full cursor-pointer"
            style={{
              width: 44,
              height: 44,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            <ArrowsClockwise size={18} style={{ color: 'rgba(255,255,255,0.6)' }} />
          </button>
          <HoldToLogoutKiosk />
        </div>
      </div>

      {mode === 'scanning' && (
        <div className="flex-1 flex flex-col landscape:flex-row items-center justify-center gap-8 p-8 overflow-auto">
          <div className="w-full max-w-2xl landscape:max-h-[80vh] landscape:w-auto">
            <QrScanner onScan={handleScan} ready={scannerReady} mode="kiosk" />
          </div>
          <div className="flex flex-col items-center gap-8">
            <p className="text-gray-300 text-2xl uppercase tracking-widest text-center">
              Présentez votre QR code
            </p>
            <p className="text-gray-600 text-sm">
              Ouvrez l&apos;app Synapse → QR Code
            </p>
            <KioskManualEntry onSubmit={handleScan} disabled={!scannerReady} />
          </div>
        </div>
      )}

      {mode === 'qr-display' && drop && <KioskQrDisplay drop={drop} />}

      {mode === 'result' && lastResult && (
        <div className="flex-1 flex items-center justify-center p-8">
          <KioskResult result={lastResult} onReset={handleReset} />
        </div>
      )}
    </div>
  )
}
