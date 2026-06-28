'use client'

import { useAction } from 'next-safe-action/hooks'
import { fulfilRedemptionAction, rejectRedemptionAction } from '@/actions/employee/loyalty-requests'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function RequestActions({ requestId }: { requestId: string }) {
  const { execute: fulfil, status: fulfilStatus } = useAction(fulfilRedemptionAction, {
    onSuccess: ({ data }) =>
      toast.success(`Récompense accordée — ${data?.pointsDeducted} pts déduits`),
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  const { execute: reject, status: rejectStatus } = useAction(rejectRedemptionAction, {
    onSuccess: () => toast.success('Demande refusée'),
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  const busy = fulfilStatus === 'executing' || rejectStatus === 'executing'

  return (
    <div className="flex gap-2 shrink-0">
      <Button
        size="sm"
        disabled={busy}
        onClick={() => fulfil({ request_id: requestId })}
      >
        {fulfilStatus === 'executing' ? '...' : 'Confirmer'}
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => reject({ request_id: requestId })}
      >
        {rejectStatus === 'executing' ? '...' : 'Refuser'}
      </Button>
    </div>
  )
}
