'use client'

import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { archiveUserAction } from '@/actions/admin/students'

interface ArchiveButtonProps {
  id: string
  label?: string
}

export function ArchiveButton({ id, label = 'Archiver' }: ArchiveButtonProps) {
  const { execute, status } = useAction(archiveUserAction, {
    onSuccess: () => toast.success('Utilisateur archivé'),
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  function handleClick() {
    if (!window.confirm('Archiver cet utilisateur ? Il ne pourra plus se connecter.')) return
    execute({ id })
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={status === 'executing'}
      className="text-orange-600 border-orange-200 hover:bg-orange-50"
    >
      {status === 'executing' ? '…' : label}
    </Button>
  )
}
