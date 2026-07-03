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
import { requestSeatSwap } from '@/actions/student/seat-swap'
import { toast } from 'sonner'
import type { Seat } from '@/data/admin/seat-map'

type Props = {
  seat: Seat | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SeatSwapRequestDialog({ seat, open, onOpenChange }: Props) {
  const router = useRouter()
  const { execute, isPending } = useAction(requestSeatSwap, {
    onSuccess: () => {
      toast.success('Demande envoyée — en attente de validation par un employé.')
      onOpenChange(false)
      router.push('/student/reservation')
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur lors de la demande.'),
  })

  function handleConfirm() {
    if (!seat) return
    execute({ toSeatId: seat.id })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Demander la place {seat?.label}</DialogTitle>
          <DialogDescription>
            Un employé doit valider ce changement avant qu&apos;il ne prenne effet.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Annuler
          </Button>
          <Button onClick={handleConfirm} disabled={isPending || !seat}>
            {isPending ? 'Envoi…' : 'Demander'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
