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
import { createReservation } from '@/actions/student/reservations'
import { toast } from 'sonner'
import type { Seat } from '@/data/admin/seat-map'

type Props = {
  seat: Seat | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReservationPlaceholderDialog({ seat, open, onOpenChange }: Props) {
  const { execute, isPending } = useAction(createReservation, {
    onSuccess: ({ data }) => {
      if (data?.error) {
        toast.error(data.error)
        return
      }
      toast.success(
        data?.examMode
          ? `Place ${seat?.label} réservée — position ${data.queuePosition} dans la file.`
          : `Place ${seat?.label} réservée pour ${data?.holdMinutes} minutes.`
      )
      onOpenChange(false)
    },
    onError: () => toast.error('Erreur lors de la réservation. Veuillez réessayer.'),
  })

  function handleConfirm() {
    if (!seat) return
    execute({ seat_id: seat.id })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Réserver la place {seat?.label}</DialogTitle>
          <DialogDescription>
            Confirmer la réservation de cette place ? Elle sera maintenue le temps configuré par l&apos;administration.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Annuler
          </Button>
          <Button onClick={handleConfirm} disabled={isPending || !seat}>
            {isPending ? 'Réservation…' : 'Confirmer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
