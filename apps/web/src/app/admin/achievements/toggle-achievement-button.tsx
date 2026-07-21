'use client'

import { useAction } from 'next-safe-action/hooks'
import { toggleAchievementAction } from '@/actions/admin/achievements'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function ToggleAchievementButton({
  id,
  isActive,
}: {
  id: string
  isActive: boolean
}) {
  const { execute, status } = useAction(toggleAchievementAction, {
    onSuccess: () =>
      toast.success(isActive ? 'Succès désactivé' : 'Succès activé'),
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
