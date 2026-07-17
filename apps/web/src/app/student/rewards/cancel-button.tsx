'use client'

import { useAction } from 'next-safe-action/hooks'
import { cancelRedemptionAction } from '@/actions/student/cancel-redemption'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function CancelButton({ requestId }: { requestId: string }) {
  const { execute, status } = useAction(cancelRedemptionAction, {
    onSuccess: () => toast.success('Demande annulée, points remboursés.'),
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
      disabled={status === 'executing'}
      onClick={() => execute({ request_id: requestId })}
    >
      {status === 'executing' ? '...' : 'Annuler'}
    </Button>
  )
}
