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
import { Input } from '@/components/ui/input'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { updateRoomSchema, type UpdateRoomInput } from '@/utils/zod-schemas/room'
import { updateRoomAction } from '@/actions/admin/rooms'
import { PencilSimple } from '@phosphor-icons/react'
import type { Room } from '@/data/admin/rooms'

export function EditRoomDialog({ room }: { room: Room }) {
  const [open, setOpen] = useState(false)

  const form = useForm<UpdateRoomInput>({
    resolver: zodResolver(updateRoomSchema),
    defaultValues: { id: room.id, name: room.name, capacity: room.capacity },
  })

  const { execute, isPending } = useAction(updateRoomAction, {
    onSuccess: () => {
      toast.success('Salle mise à jour')
      setOpen(false)
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? 'Erreur lors de la mise à jour')
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Modifier">
          <PencilSimple className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier la salle</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => execute(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom de la salle</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacité (places)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
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
                {isPending ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
