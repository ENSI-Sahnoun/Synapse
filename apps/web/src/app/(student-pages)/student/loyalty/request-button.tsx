'use client'

import { useAction } from 'next-safe-action/hooks'
import { requestRedemptionAction } from '@/actions/student/request-redemption'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface Props {
  ruleId: string
  canRedeem: boolean
  alreadyPending: boolean
}

export function RequestButton({ ruleId, canRedeem, alreadyPending }: Props) {
  const { execute, status } = useAction(requestRedemptionAction, {
    onSuccess: ({ data }) =>
      toast.success(`Demande envoyée pour "${data?.ruleName}". Un employé validera votre récompense.`),
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  if (alreadyPending) {
    return (
      <span className="text-xs text-amber-600 font-medium whitespace-nowrap">
        En attente…
      </span>
    )
  }

  return (
    <Button
      size="sm"
      disabled={!canRedeem || status === 'executing'}
      onClick={() => execute({ rule_id: ruleId })}
    >
      {status === 'executing' ? '...' : 'Demander'}
    </Button>
  )
}
