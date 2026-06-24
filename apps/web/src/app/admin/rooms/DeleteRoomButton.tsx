'use client'

import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { deleteRoomAction } from '@/actions/admin/rooms'
import { Trash } from '@phosphor-icons/react'

export function DeleteRoomButton({ roomId, roomName }: { roomId: string; roomName: string }) {
  const { execute, isPending } = useAction(deleteRoomAction, {
    onSuccess: () => {
      toast.success(`Salle "${roomName}" supprimée`)
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'Erreur lors de la suppression')
    },
  })

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title="Supprimer">
          <Trash className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer la salle ?</AlertDialogTitle>
          <AlertDialogDescription>
            La salle <strong>{roomName}</strong> et toutes ses places seront supprimées définitivement. Cette action est irréversible.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => execute({ id: roomId })}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? 'Suppression…' : 'Supprimer'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
