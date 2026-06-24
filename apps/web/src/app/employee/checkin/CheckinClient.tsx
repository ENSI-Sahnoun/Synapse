'use client'

import { useState, useCallback, useRef } from 'react'
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

const PREFIX = 'SYNAPSE-'

export function CheckinClient({ initialOpenAttendance }: CheckinClientProps) {
  const [scannerReady, setScannerReady] = useState(true)
  const [lastResult, setLastResult] = useState<CheckinResultType | null>(null)
  const [openAttendance, setOpenAttendance] = useState(initialOpenAttendance)
  const [mode, setMode] = useState<'scan' | 'manual'>('scan')
  const [manualCode, setManualCode] = useState(PREFIX)
  const inputRef = useRef<HTMLInputElement>(null)

  const { execute: executeCheckin, isPending } = useAction(checkinAction, {
    onSuccess: ({ data }) => {
      if (!data) return
      setLastResult(data)
      setManualCode(PREFIX)
    },
    onError: () => {
      setLastResult({ status: 'DENIED_UNKNOWN' })
      setManualCode(PREFIX)
    },
  })

  const { execute: executeCheckout } = useAction(checkoutAction, {
    onSuccess: ({ input }) => {
      setOpenAttendance((prev) =>
        prev.filter((a) => a.id !== input?.attendanceId)
      )
    },
  })

  const submitToken = useCallback(
    (token: string) => {
      setScannerReady(false)
      executeCheckin({ qrToken: token })
    },
    [executeCheckin]
  )

  const handleScan = useCallback(
    (token: string) => {
      if (!scannerReady) return
      submitToken(token)
    },
    [scannerReady, submitToken]
  )

  const handleManualSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const token = manualCode.trim()
      if (!token || token === PREFIX) return
      submitToken(token)
    },
    [manualCode, submitToken]
  )

  const handleReset = useCallback(() => {
    setLastResult(null)
    setScannerReady(true)
    if (mode === 'manual') {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [mode])

  const handleManualCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (!val.startsWith(PREFIX)) {
      setManualCode(PREFIX)
    } else {
      setManualCode(val)
    }
  }, [])

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Contrôle d&apos;accès</h2>
          <div className="flex rounded-lg border overflow-hidden text-xs">
            <button
              onClick={() => setMode('scan')}
              className={`px-3 py-1.5 ${mode === 'scan' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
            >
              Scanner
            </button>
            <button
              onClick={() => { setMode('manual'); setTimeout(() => inputRef.current?.focus(), 50) }}
              className={`px-3 py-1.5 ${mode === 'manual' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
            >
              Code manuel
            </button>
          </div>
        </div>

        {lastResult ? (
          <CheckinResult result={lastResult} onReset={handleReset} />
        ) : mode === 'scan' ? (
          <QrScanner onScan={handleScan} ready={scannerReady} />
        ) : (
          <form
            onSubmit={handleManualSubmit}
            className="w-full max-w-sm mx-auto flex flex-col gap-3"
          >
            <label className="text-sm text-muted-foreground">
              Code secret de l&apos;étudiant
            </label>
            <input
              ref={inputRef}
              type="text"
              value={manualCode}
              onChange={handleManualCodeChange}
              placeholder={`${PREFIX}…`}
              spellCheck={false}
              autoCapitalize="characters"
              className="w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={isPending || manualCode.trim() === PREFIX}
              className="w-full rounded-lg bg-primary text-primary-foreground py-2 text-sm font-medium disabled:opacity-50"
            >
              {isPending ? 'Vérification…' : 'Valider'}
            </button>
          </form>
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
