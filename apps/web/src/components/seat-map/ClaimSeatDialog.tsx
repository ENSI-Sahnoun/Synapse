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
import { claimSeat } from '@/actions/student/seat-swap'
import { toast } from 'sonner'
import type { Seat } from '@/data/admin/seat-map'

type Props = {
  seat: Seat | null
  roomId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

// A "Divers" student (present, seatless) claiming a FREE seat: no one to swap
// with, so it's assigned instantly — no staff approval needed.
export function ClaimSeatDialog({ seat, roomId, open, onOpenChange }: Props) {
  const router = useRouter()
  const { execute, isPending } = useAction(claimSeat, {
    onSuccess: () => {
      toast.success('Place attribuée. Bonne session !')
      onOpenChange(false)
      router.push('/student/dashboard')
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur lors de l\'attribution.'),
  })

  function handleConfirm() {
    if (!seat) return
    execute({ seatId: seat.id, roomId })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Prendre la place {seat?.label}</DialogTitle>
          <DialogDescription>
            Cette place est libre — elle vous sera attribuée immédiatement.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Annuler
          </Button>
          <Button onClick={handleConfirm} disabled={isPending || !seat}>
            {isPending ? 'Attribution…' : 'Prendre la place'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
