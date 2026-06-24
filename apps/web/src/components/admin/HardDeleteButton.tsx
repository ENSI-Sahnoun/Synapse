'use client'

import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { hardDeleteUserAction } from '@/actions/admin/students'

interface HardDeleteButtonProps {
  id: string
  name: string
}

export function HardDeleteButton({ id, name }: HardDeleteButtonProps) {
  const { execute, status } = useAction(hardDeleteUserAction, {
    onSuccess: () => toast.success('Utilisateur supprimé définitivement'),
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  function handleClick() {
    const confirmed = window.confirm(
      `Supprimer définitivement "${name}" ?\n\nCette action est IRRÉVERSIBLE. Toutes les données (présences, abonnements) seront perdues.`
    )
    if (!confirmed) return
    execute({ id })
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={handleClick}
      disabled={status === 'executing'}
    >
      {status === 'executing' ? '…' : 'Supprimer'}
    </Button>
  )
}
