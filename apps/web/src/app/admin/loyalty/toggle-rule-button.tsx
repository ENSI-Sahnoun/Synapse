'use client'

import { useAction } from 'next-safe-action/hooks'
import { toggleLoyaltyRuleAction } from '@/actions/admin/loyalty-rules'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function ToggleRuleButton({ id, isActive }: { id: string; isActive: boolean }) {
  const { execute, status } = useAction(toggleLoyaltyRuleAction, {
    onSuccess: () =>
      toast.success(isActive ? 'Règle désactivée' : 'Règle activée'),
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
