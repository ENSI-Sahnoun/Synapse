'use client'

import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updateProductAction } from '@/actions/admin/products'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { updateProductSchema, type UpdateProductInput } from '@/utils/zod-schemas/product'
import type { AdminProduct } from '@/data/admin/products'
import Link from 'next/link'

export function EditProductForm({ product }: { product: AdminProduct }) {
  const router = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<UpdateProductInput>({
    resolver: zodResolver(updateProductSchema) as any,
    defaultValues: {
      id: product.id,
      name: product.name,
      category: product.category,
      price_dt: product.price_dt,
      stock_quantity: product.stock_quantity,
    },
  })

  const { execute, status } = useAction(updateProductAction, {
    onSuccess: () => { toast.success('Produit mis à jour'); router.push('/admin/products') },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  return (
    <>
      <Link href="/admin/products" className="text-sm text-muted-foreground hover:underline">
        ← Produits
      </Link>
      <form onSubmit={form.handleSubmit((d) => execute(d))} className="space-y-4 max-w-sm">
        <input type="hidden" {...form.register('id')} />
        <div className="space-y-1">
          <Label>Nom *</Label>
          <Input {...form.register('name')} />
          {form.formState.errors.name && (
            <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label>Catégorie *</Label>
          <Input {...form.register('category')} />
          {form.formState.errors.category && (
            <p className="text-sm text-destructive">{form.formState.errors.category.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label>Prix (DT) *</Label>
          <Input type="number" step="0.1" min="0" {...form.register('price_dt')} />
          {form.formState.errors.price_dt && (
            <p className="text-sm text-destructive">{form.formState.errors.price_dt.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label>Stock</Label>
          <Input type="number" min="0" {...form.register('stock_quantity')} />
          {form.formState.errors.stock_quantity && (
            <p className="text-sm text-destructive">{form.formState.errors.stock_quantity.message}</p>
          )}
        </div>
        <Button type="submit" disabled={status === 'executing'}>
          {status === 'executing' ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </form>
    </>
  )
}
