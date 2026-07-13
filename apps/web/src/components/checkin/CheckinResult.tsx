'use client'

import { useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { CheckinResult as CheckinResultType } from '@/utils/zod-schemas/checkin'

interface CheckinResultProps {
  result: CheckinResultType
  onReset: () => void
}

const STATUS_CONFIG = {
  AUTHORIZED: {
    bg: 'bg-green-50 border-green-200',
    heading: 'text-green-800',
    badge: 'bg-green-100 text-green-800',
    label: 'AUTORISÉ',
  },
  DENIED_EXPIRED: {
    bg: 'bg-red-50 border-red-200',
    heading: 'text-red-800',
    badge: 'bg-red-100 text-red-800',
    label: 'REFUSÉ — EXPIRÉ',
  },
  DENIED_NO_SUB: {
    bg: 'bg-red-50 border-red-200',
    heading: 'text-red-800',
    badge: 'bg-red-100 text-red-800',
    label: 'REFUSÉ — SANS ABONNEMENT',
  },
  DENIED_UNKNOWN: {
    bg: 'bg-red-50 border-red-200',
    heading: 'text-red-800',
    badge: 'bg-red-100 text-red-800',
    label: 'QR NON RECONNU',
  },
  ALREADY_IN: {
    bg: 'bg-yellow-50 border-yellow-200',
    heading: 'text-yellow-800',
    badge: 'bg-yellow-100 text-yellow-800',
    label: 'DÉJÀ PRÉSENT',
  },
  DENIED_NO_RESERVATION: {
    bg: 'bg-red-50 border-red-200',
    heading: 'text-red-800',
    badge: 'bg-red-100 text-red-800',
    label: 'REFUSÉ — PAS DE RÉSERVATION',
  },
  EMPLOYEE_CLOCKED_IN: {
    bg: 'bg-green-50 border-green-200',
    heading: 'text-green-800',
    badge: 'bg-green-100 text-green-800',
    label: 'POINTAGE ENREGISTRÉ',
  },
  EMPLOYEE_CLOCKED_OUT: {
    bg: 'bg-yellow-50 border-yellow-200',
    heading: 'text-yellow-800',
    badge: 'bg-yellow-100 text-yellow-800',
    label: 'SORTIE ENREGISTRÉE',
  },
} satisfies Record<CheckinResultType['status'], { bg: string; heading: string; badge: string; label: string }>

function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd MMMM yyyy', { locale: fr })
  } catch {
    return dateStr
  }
}

export function CheckinResult({ result, onReset }: CheckinResultProps) {
  useEffect(() => {
    const timer = setTimeout(onReset, 4000)
    return () => clearTimeout(timer)
  }, [result, onReset])

  const config = STATUS_CONFIG[result.status]

  return (
    <div className={`w-full max-w-sm mx-auto rounded-xl border p-6 ${config.bg} flex flex-col gap-4`}>
      <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide self-start ${config.badge}`}>
        {config.label}
      </div>

      {result.status === 'AUTHORIZED' && (
        <>
          <div>
            <p className={`text-2xl font-bold ${config.heading}`}>{result.studentName}</p>
            <p className="text-sm text-muted-foreground mt-1">{result.planName}</p>
            {result.reservationFulfilled && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 mt-1">
                Réservation confirmée
              </span>
            )}
          </div>
          <div className="text-sm space-y-1">
            <p>Expire le : <span className="font-medium">{formatDate(result.endDate)}</span></p>
            <p>Jours restants : <span className="font-medium">{result.daysRemaining}</span></p>
          </div>
        </>
      )}

      {result.status === 'DENIED_EXPIRED' && (
        <>
          <p className={`text-2xl font-bold ${config.heading}`}>{result.studentName}</p>
          <p className="text-sm">
            Abonnement expiré le : <span className="font-medium">{formatDate(result.endDate)}</span>
          </p>
        </>
      )}

      {result.status === 'DENIED_NO_SUB' && (
        <p className={`text-xl font-bold ${config.heading}`}>{result.studentName}</p>
      )}

      {result.status === 'DENIED_UNKNOWN' && (
        <p className="text-sm text-muted-foreground">
          Ce code QR n&apos;est pas associé à un compte Synapse valide.
        </p>
      )}

      {result.status === 'ALREADY_IN' && (
        <>
          <p className={`text-2xl font-bold ${config.heading}`}>{result.studentName}</p>
          <p className="text-sm">
            Entrée enregistrée à : <span className="font-medium">{format(parseISO(result.checkedInAt), 'HH:mm', { locale: fr })}</span>
          </p>
        </>
      )}

      {result.status === 'DENIED_NO_RESERVATION' && (
        <>
          <p className={`text-2xl font-bold ${config.heading}`}>{result.studentName}</p>
          <p className="text-sm text-muted-foreground mt-1">
            Mode examen actif — une réservation préalable est obligatoire.
          </p>
        </>
      )}

      <p className="text-xs text-muted-foreground text-right">Réinitialisation dans 4 s…</p>
    </div>
  )
}
