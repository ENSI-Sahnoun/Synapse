'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { setRoomStatusSchema, type SetRoomStatusInput } from '@/utils/zod-schemas/room'
import { setRoomStatusAction } from '@/actions/admin/rooms'
import { Sliders } from '@phosphor-icons/react'
import type { Room } from '@/data/admin/rooms'

export function SetRoomStatusDialog({ room }: { room: Room }) {
  const [open, setOpen] = useState(false)

  const form = useForm<SetRoomStatusInput>({
    resolver: zodResolver(setRoomStatusSchema),
    defaultValues: {
      id: room.id,
      status: room.status as 'open' | 'closed' | 'reserved',
      status_note: room.status_note ?? '',
    },
  })

  const { execute, isPending } = useAction(setRoomStatusAction, {
    onSuccess: () => {
      toast.success('Statut mis à jour')
      setOpen(false)
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'Erreur lors du changement de statut')
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Changer le statut">
          <Sliders className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Statut de la salle — {room.name}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => execute(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Statut</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir un statut" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="open">Ouvert</SelectItem>
                      <SelectItem value="closed">Fermé</SelectItem>
                      <SelectItem value="reserved">Réservé</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status_note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ex: Fermé pour maintenance jusqu'à 14h"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Enregistrement…' : 'Appliquer'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
