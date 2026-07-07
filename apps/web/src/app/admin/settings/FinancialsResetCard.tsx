'use client'

import { useAction } from 'next-safe-action/hooks'
import { resetFinancialsPeriod } from '@/actions/admin/data-reset'
import { DataResetCard } from './DataResetCard'

export function FinancialsResetCard() {
  const { execute, status } = useAction(resetFinancialsPeriod)

  return (
    <DataResetCard
      title="Réinitialiser les données financières"
      description="Supprime définitivement dépenses, ventes et abonnements sur la période choisie. N'affecte pas les comptes étudiants. Export PDF obligatoire avant suppression."
      exportUrl={(from, to) => `/api/admin/accounting/export/transactions-pdf?from=${from}&to=${to}`}
      isExecuting={status === 'executing'}
      onDelete={(args) => execute(args)}
    />
  )
}
