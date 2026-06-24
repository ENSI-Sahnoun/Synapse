'use client'

import { useState, useCallback } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { QrScanner } from '@/components/checkin/QrScanner'
import { CheckinResult } from '@/components/checkin/CheckinResult'
import { checkinAction } from '@/actions/checkin/checkin-action'
import { checkoutAction } from '@/actions/checkin/checkout-action'
import type { CheckinResult as CheckinResultType } from '@/utils/zod-schemas/checkin'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

interface OpenAttendance {
  id: string
  studentName: string
  checkedInAt: string
}

interface CheckinClientProps {
  initialOpenAttendance: OpenAttendance[]
}

export function CheckinClient({ initialOpenAttendance }: CheckinClientProps) {
  const [scannerReady, setScannerReady] = useState(true)
  const [lastResult, setLastResult] = useState<CheckinResultType | null>(null)
  const [openAttendance, setOpenAttendance] = useState(initialOpenAttendance)

  const { execute: executeCheckin } = useAction(checkinAction, {
    onSuccess: ({ data }) => {
      if (!data) return
      setLastResult(data)
    },
    onError: () => {
      setLastResult({ status: 'DENIED_UNKNOWN' })
    },
  })

  const { execute: executeCheckout } = useAction(checkoutAction, {
    onSuccess: ({ input }) => {
      setOpenAttendance((prev) =>
        prev.filter((a) => a.id !== input?.attendanceId)
      )
    },
  })

  const handleScan = useCallback(
    (token: string) => {
      if (!scannerReady) return
      setScannerReady(false)
      executeCheckin({ qrToken: token })
    },
    [scannerReady, executeCheckin]
  )

  const handleReset = useCallback(() => {
    setLastResult(null)
    setScannerReady(true)
  }, [])

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="text-base font-semibold mb-3">Scanner un QR Code</h2>
        {lastResult ? (
          <CheckinResult result={lastResult} onReset={handleReset} />
        ) : (
          <QrScanner onScan={handleScan} ready={scannerReady} />
        )}
      </section>

      <section>
        <h2 className="text-base font-semibold mb-3">
          Présents ({openAttendance.length})
        </h2>
        {openAttendance.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun étudiant présent pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {openAttendance.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between border rounded-lg px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{a.studentName}</p>
                  <p className="text-xs text-muted-foreground">
                    Entrée à{' '}
                    {format(parseISO(a.checkedInAt), 'HH:mm', { locale: fr })}
                  </p>
                </div>
                <button
                  onClick={() => executeCheckout({ attendanceId: a.id })}
                  className="text-xs border rounded-md px-3 py-1.5 hover:bg-accent"
                >
                  Sortie
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
