'use client'

import { useAction } from 'next-safe-action/hooks'
import { resetNotificationsPeriod } from '@/actions/admin/data-reset'
import { DataResetCard } from './DataResetCard'

export function NotificationsResetCard() {
  const { execute, status } = useAction(resetNotificationsPeriod)

  return (
    <DataResetCard
      title="Réinitialiser les notifications"
      description="Supprime définitivement les notifications enregistrées sur la période choisie. N'affecte pas les comptes étudiants."
      isExecuting={status === 'executing'}
      onDelete={(args) => execute(args)}
    />
  )
}
