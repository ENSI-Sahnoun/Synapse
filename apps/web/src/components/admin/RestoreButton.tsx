'use client'

import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { restoreUserAction } from '@/actions/admin/students'

interface RestoreButtonProps {
  id: string
}

export function RestoreButton({ id }: RestoreButtonProps) {
  const { execute, status } = useAction(restoreUserAction, {
    onSuccess: () => toast.success('Utilisateur restauré'),
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => execute({ id })}
      disabled={status === 'executing'}
      className="text-green-600 border-green-200 hover:bg-green-50"
    >
      {status === 'executing' ? '…' : 'Restaurer'}
    </Button>
  )
}
