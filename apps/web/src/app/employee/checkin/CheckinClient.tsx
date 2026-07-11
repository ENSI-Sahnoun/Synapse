'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAction } from 'next-safe-action/hooks'
import { QrScanner } from '@/components/checkin/QrScanner'
import { useQrAirdropFeed } from '@/hooks/use-qr-airdrop-feed'
import { checkinAction } from '@/actions/checkin/checkin-action'
import { PostCheckinSeatDialog } from '@/components/checkin/PostCheckinSeatDialog'
import type { CheckinResult as CheckinResultType } from '@/utils/zod-schemas/checkin'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

interface CheckinClientProps {
  todayTotal: number
  currentlyIn: number
  checkedOut: number
}

const PREFIX = 'SYNAPSE-'

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function CheckinClient({
  todayTotal,
  currentlyIn,
  checkedOut,
}: CheckinClientProps) {
  const [scannerReady, setScannerReady] = useState(true)
  const [lastResult, setLastResult] = useState<CheckinResultType | null>(null)
  const [manualCode, setManualCode] = useState(PREFIX)
  const [seatDialogOpen, setSeatDialogOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const [airdropFlash, setAirdropFlash] = useState(false)

  const applyAirdroppedToken = useCallback((token: string) => {
    setManualCode(token)
    setAirdropFlash(true)
    inputRef.current?.focus()
    setTimeout(() => setAirdropFlash(false), 1200)
  }, [])

  useQrAirdropFeed((drop) => applyAirdroppedToken(drop.qrToken))

  useEffect(() => {
    const stored = sessionStorage.getItem('airdropQrToken')
    if (stored) {
      sessionStorage.removeItem('airdropQrToken')
      applyAirdroppedToken(stored)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { execute: executeCheckin, isPending } = useAction(checkinAction, {
    onSuccess: ({ data }) => {
      if (!data) return
      setLastResult(data)
      setManualCode(PREFIX)
      if (data.status === 'AUTHORIZED' && !data.reservationFulfilled) {
        setSeatDialogOpen(true)
      }
      // Re-run the server component so Aujourd'hui/Présents/Sortis reflect this scan
      router.refresh()
    },
    onError: () => {
      setLastResult({ status: 'DENIED_UNKNOWN' })
      setManualCode(PREFIX)
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
  }, [])

  const handleManualCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (!val.startsWith(PREFIX)) {
      setManualCode(PREFIX)
    } else {
      setManualCode(val)
    }
  }, [])

  const isAuthorized = lastResult?.status === 'AUTHORIZED'
  const isDenied =
    lastResult?.status === 'DENIED_EXPIRED' ||
    lastResult?.status === 'DENIED_NO_SUB' ||
    lastResult?.status === 'DENIED_UNKNOWN' ||
    lastResult?.status === 'DENIED_NO_RESERVATION'
  const isAlreadyIn = lastResult?.status === 'ALREADY_IN'

  function getOverlayMessage(): string {
    if (!lastResult) return ''
    if (lastResult.status === 'AUTHORIZED') return 'Accès autorisé'
    if (lastResult.status === 'ALREADY_IN') return 'Déjà présent'
    if (lastResult.status === 'DENIED_EXPIRED') return 'Abonnement expiré'
    if (lastResult.status === 'DENIED_NO_SUB') return 'Aucun abonnement'
    if (lastResult.status === 'DENIED_NO_RESERVATION') return 'Aucune réservation'
    return 'Accès refusé'
  }

  const showOverlay = !!lastResult
  const overlayBg = isAuthorized
    ? 'rgba(22,163,74,0.88)'
    : isDenied || isAlreadyIn
    ? 'rgba(220,38,38,0.85)'
    : 'transparent'

  const buttonLabel = isPending
    ? 'Valider…'
    : lastResult
    ? 'Scanner un autre'
    : 'Appuyer pour scanner'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        @keyframes scan-line {
          0%, 100% { top: 12%; }
          50% { top: 78%; }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[
          { label: "Aujourd'hui", value: todayTotal, color: 'var(--accent-brand)' },
          { label: 'Présents', value: currentlyIn, color: 'var(--synapse-green-500)' },
          { label: 'Sortis', value: checkedOut, color: 'var(--muted-foreground)' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            style={{
              background: 'white',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '12px 10px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                color,
              }}
            >
              {value}
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-tertiary)',
                marginTop: 2,
              }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Scanner card */}
      <div
        style={{
          background: 'white',
          borderRadius: 'var(--radius-xl)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div style={{ width: '100%' }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-tertiary)',
            }}
          >
            QR Scanner
          </span>
        </div>

        {/* Viewport */}
        <div
          style={{
            background: '#111',
            borderRadius: 'var(--radius-xl)',
            width: '100%',
            maxWidth: 260,
            aspectRatio: '1',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <QrScanner onScan={handleScan} ready={scannerReady} />

          {/* Corner brackets */}
          {(['tl', 'tr', 'bl', 'br'] as const).map((pos) => (
            <div
              key={pos}
              style={{
                position: 'absolute',
                width: 28,
                height: 28,
                top: pos.startsWith('t') ? 14 : undefined,
                bottom: pos.startsWith('b') ? 14 : undefined,
                left: pos.endsWith('l') ? 14 : undefined,
                right: pos.endsWith('r') ? 14 : undefined,
                borderTop: pos.startsWith('t') ? '3px solid var(--accent-brand)' : undefined,
                borderBottom: pos.startsWith('b') ? '3px solid var(--accent-brand)' : undefined,
                borderLeft: pos.endsWith('l') ? '3px solid var(--accent-brand)' : undefined,
                borderRight: pos.endsWith('r') ? '3px solid var(--accent-brand)' : undefined,
              }}
            />
          ))}

          {/* Scan line */}
          {isPending && (
            <div
              style={{
                position: 'absolute',
                left: 16,
                right: 16,
                height: 2,
                background: 'var(--accent-brand)',
                animation: 'scan-line 1.1s ease-in-out infinite',
              }}
            />
          )}

          {/* Result overlay */}
          {showOverlay && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: overlayBg,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                animation: 'slide-up 0.25s ease',
              }}
            >
              {isAuthorized ? (
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6l12 12M18 6L6 18" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              )}
              <span style={{ color: 'white', fontWeight: 600, fontSize: 15, textAlign: 'center', padding: '0 12px' }}>
                {getOverlayMessage()}
              </span>
            </div>
          )}
        </div>

        {/* Primary button */}
        <button
          onClick={lastResult ? handleReset : undefined}
          disabled={isPending}
          style={{
            width: '100%',
            maxWidth: 260,
            padding: '10px 0',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--accent-brand)',
            color: 'white',
            fontWeight: 600,
            fontSize: 14,
            border: 'none',
            cursor: isPending ? 'default' : 'pointer',
            opacity: isPending ? 0.7 : 1,
          }}
        >
          {buttonLabel}
        </button>

        {/* Manual entry */}
        <div
          style={{
            width: '100%',
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: 14,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-tertiary)',
              marginBottom: 8,
            }}
          >
            Entrée manuelle
          </div>
          <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: 8 }}>
            <input
              ref={inputRef}
              type="text"
              value={manualCode}
              onChange={handleManualCodeChange}
              placeholder={`${PREFIX}…`}
              spellCheck={false}
              autoCapitalize="characters"
              style={{
                flex: 1,
                border: airdropFlash ? '1px solid var(--synapse-green-500)' : '1px solid var(--border-default)',
                borderRadius: 'var(--radius-lg)',
                padding: '8px 10px',
                fontSize: 13,
                fontFamily: 'monospace',
                background: airdropFlash ? 'var(--synapse-green-50)' : 'transparent',
                outline: 'none',
                minWidth: 0,
                transition: 'background-color 0.3s ease, border-color 0.3s ease',
              }}
            />
            <button
              type="submit"
              disabled={isPending || manualCode.trim() === PREFIX}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--accent-brand)',
                color: 'white',
                fontWeight: 600,
                fontSize: 13,
                border: 'none',
                cursor: 'pointer',
                opacity: isPending || manualCode.trim() === PREFIX ? 0.5 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              Valider
            </button>
          </form>
        </div>
      </div>

      {/* Result card — shown only when AUTHORIZED */}
      {lastResult?.status === 'AUTHORIZED' && (
        <div
          style={{
            background: 'white',
            border: '1px solid var(--synapse-green-500)',
            borderRadius: 'var(--radius-xl)',
            padding: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                background: 'var(--accent-brand)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 15,
                fontFamily: 'var(--font-display)',
                flexShrink: 0,
              }}
            >
              {getInitials(lastResult.studentName)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>
                {lastResult.studentName}
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 2 }}>
                {lastResult.planName}
              </div>
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--synapse-green-500)',
                background: 'rgba(22,163,74,0.1)',
                borderRadius: 99,
                padding: '3px 9px',
                whiteSpace: 'nowrap',
              }}
            >
              Présent
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px 16px',
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: 12,
            }}
          >
            {[
              { label: 'Plan', value: lastResult.planName },
              { label: 'Salle', value: '—' },
              {
                label: 'Validité',
                value: format(parseISO(lastResult.endDate), 'd MMM yyyy', { locale: fr }),
              },
              {
                label: 'Jours restants',
                value: String(lastResult.daysRemaining),
              },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>
                  {label}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {lastResult?.status === 'AUTHORIZED' && (
        <PostCheckinSeatDialog
          open={seatDialogOpen}
          onOpenChange={setSeatDialogOpen}
          attendanceId={lastResult.attendanceId}
          studentName={lastResult.studentName}
        />
      )}
    </div>
  )
}
