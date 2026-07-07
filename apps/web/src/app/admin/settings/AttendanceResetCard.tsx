'use client'

import { useAction } from 'next-safe-action/hooks'
import { resetAttendancePeriod } from '@/actions/admin/data-reset'
import { DataResetCard } from './DataResetCard'

export function AttendanceResetCard() {
  const { execute, status } = useAction(resetAttendancePeriod)

  return (
    <DataResetCard
      title="Réinitialiser présence et réservations"
      description="Supprime définitivement les enregistrements de présence et réservations sur la période choisie. N'affecte pas les comptes étudiants. Export PDF obligatoire avant suppression."
      exportUrl={(from, to) => `/api/admin/attendance/export/pdf?from=${from}&to=${to}`}
      isExecuting={status === 'executing'}
      onDelete={(args) => execute(args)}
    />
  )
}
