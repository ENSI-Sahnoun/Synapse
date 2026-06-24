'use client'

import { useState, useCallback } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { QrScanner } from '@/components/checkin/QrScanner'
import { KioskResult } from '@/components/kiosk/KioskResult'
import { KioskGuard } from '@/components/kiosk/KioskGuard'
import { checkinAction } from '@/actions/checkin/checkin-action'
import type { CheckinResult } from '@/utils/zod-schemas/checkin'

export function KioskClient() {
  const [scannerReady, setScannerReady] = useState(true)
  const [lastResult, setLastResult] = useState<CheckinResult | null>(null)

  const { execute } = useAction(checkinAction, {
    onSuccess: ({ data }) => {
      if (!data) return
      setLastResult(data)
    },
    onError: () => {
      setLastResult({ status: 'DENIED_UNKNOWN' })
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
  }, [])

  return (
    <div className="w-screen h-screen bg-black text-white flex flex-col">
      <KioskGuard />

      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-800">
        <span className="text-xl font-bold tracking-widest">SYNAPSE</span>
        <span className="text-gray-500 text-sm">Kiosque d&apos;accès</span>
      </div>

      {/* Main area */}
      <div className="flex-1 flex">
        {/* Left: scanner */}
        <div className="w-1/2 flex flex-col items-center justify-center gap-6 border-r border-gray-800 p-8">
          <p className="text-gray-400 text-sm uppercase tracking-widest">
            Présentez votre QR code
          </p>
          <QrScanner onScan={handleScan} ready={scannerReady} />
          <p className="text-gray-600 text-xs">
            Ouvrez l&apos;app Synapse → QR Code
          </p>
        </div>

        {/* Right: result */}
        <div className="w-1/2 flex items-center justify-center p-8">
          {lastResult ? (
            <KioskResult result={lastResult} onReset={handleReset} />
          ) : (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-24 h-24 rounded-full border-2 border-gray-700 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-12 h-12 text-gray-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
              </div>
              <p className="text-gray-500 text-lg">En attente d&apos;un scan…</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom */}
      <div className="border-t border-gray-800 px-8 py-3 flex items-center justify-center">
        <p className="text-gray-600 text-xs">
          En cas de problème, contactez l&apos;accueil — ne tentez pas de quitter cette page
        </p>
      </div>
    </div>
  )
}
