'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { swapSeatFreely } from '@/actions/student/seat-swap'
import { toast } from 'sonner'
import type { Seat } from '@/data/admin/seat-map'

type Props = {
  seat: Seat | null
  roomId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Free-swap mode (admin-enabled): a seated student moves to a free seat with no
// staff approval — the change is applied immediately.
export function FreeSwapDialog({ seat, roomId, open, onOpenChange }: Props) {
  const router = useRouter()
  const { execute, isPending } = useAction(swapSeatFreely, {
    onSuccess: () => {
      toast.success('Vous avez changé de place.')
      onOpenChange(false)
      router.push('/student/dashboard')
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur lors du changement.'),
  })

  function handleConfirm() {
    if (!seat) return
    execute({ toSeatId: seat.id, roomId })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Changer pour la place {seat?.label}</DialogTitle>
          <DialogDescription>
            Cette place est libre — le changement est immédiat, sans validation.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Annuler
          </Button>
          <Button onClick={handleConfirm} disabled={isPending || !seat}>
            {isPending ? 'Changement…' : 'Changer de place'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
