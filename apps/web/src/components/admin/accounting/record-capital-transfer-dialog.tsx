'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import {
  recordCapitalTransferSchema,
  type RecordCapitalTransferInput,
} from '@/utils/zod-schemas/capital'
import { recordCapitalTransferAction } from '@/actions/admin/capital'

export function RecordCapitalTransferDialog() {
  const [open, setOpen] = useState(false)

  const form = useForm<RecordCapitalTransferInput>({
    resolver: zodResolver(recordCapitalTransferSchema) as any,
    defaultValues: {
      from_account: 'cash',
      to_account: 'bank',
      date: new Date().toISOString().slice(0, 10),
    },
  })

  const { execute, isPending } = useAction(recordCapitalTransferAction, {
    onSuccess: () => {
      toast.success('Virement enregistré')
      form.reset()
      setOpen(false)
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erreur lors de l'enregistrement")
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Virement entre comptes</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enregistrer un virement</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => execute(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="from_account"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>De</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="cash">Caisse</SelectItem>
                      <SelectItem value="bank">Banque</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="to_account"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vers</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="cash">Caisse</SelectItem>
                      <SelectItem value="bank">Banque</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount_dt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Montant (DT)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.001" min="0" placeholder="0.000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note (optionnel)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: dépôt bancaire mensuel" {...field} />
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
