'use client'

import { useAction } from 'next-safe-action/hooks'
import { togglePlanAction } from '@/actions/admin/subscription-plans'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function TogglePlanButton({ id, isActive }: { id: string; isActive: boolean }) {
  const { execute, status } = useAction(togglePlanAction, {
    onSuccess: () => toast.success(isActive ? 'Formule désactivée' : 'Formule activée'),
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={status === 'executing'}
      onClick={() => execute({ id, is_active: !isActive })}
    >
      {isActive ? 'Désactiver' : 'Activer'}
    </Button>
  )
}
