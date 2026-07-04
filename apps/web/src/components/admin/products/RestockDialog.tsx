'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import type { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { restockProductSchema } from '@/utils/zod-schemas/restock'
import { restockProductAction } from '@/actions/admin/products'
import type { AdminProduct } from '@/data/admin/products'

export function RestockDialog({ product }: { product: AdminProduct }) {
  const [open, setOpen] = useState(false)

  const form = useForm<z.input<typeof restockProductSchema>>({
    resolver: zodResolver(restockProductSchema),
    defaultValues: {
      product_id: product.id,
      quantity: 1,
      cost_price: product.cost_price ?? 0,
      tax_rate_pct: 19,
    },
  })

  const { execute, status } = useAction(restockProductAction, {
    onSuccess: ({ data }) => {
      toast.success(`Stock mis à jour: ${data?.newStockQuantity} unité(s)`)
      setOpen(false)
      form.reset()
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  const quantity = Number(form.watch('quantity')) || 0
  const costPrice = Number(form.watch('cost_price')) || 0
  const taxRate = Number(form.watch('tax_rate_pct') ?? 19)
  const total = quantity * costPrice * (1 + taxRate / 100)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Réapprovisionner
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Réapprovisionner: {product.name}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((d) => execute(d))}
          className="space-y-4"
        >
          <div className="space-y-1">
            <Label>Quantité ajoutée</Label>
            <Input type="number" min="1" {...form.register('quantity')} />
            {form.formState.errors.quantity && (
              <p className="text-sm text-destructive">{form.formState.errors.quantity.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Coût unitaire (DT, hors taxe)</Label>
            <Input type="number" step="0.1" min="0" {...form.register('cost_price')} />
            {form.formState.errors.cost_price && (
              <p className="text-sm text-destructive">{form.formState.errors.cost_price.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>TVA (%)</Label>
            <Input type="number" step="1" min="0" max="100" {...form.register('tax_rate_pct')} />
          </div>
          <p className="text-sm text-muted-foreground">
            Total dépense: {total.toFixed(3)} DT
          </p>
          <Button type="submit" disabled={status === 'executing'}>
            {status === 'executing' ? 'Enregistrement...' : 'Confirmer'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
