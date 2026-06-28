'use client'

import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createProductAction } from '@/actions/admin/products'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createProductSchema, type CreateProductInput } from '@/utils/zod-schemas/product'
import Link from 'next/link'

export default function NewProductPage() {
  const router = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<CreateProductInput>({
    resolver: zodResolver(createProductSchema) as any,
    defaultValues: { name: '', category: '', price_dt: 0, stock_quantity: 0 },
  })

  const { execute, status } = useAction(createProductAction, {
    onSuccess: () => { toast.success('Produit créé'); router.push('/admin/products') },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  return (
    <div className="space-y-4">
      <Link href="/admin/products" className="text-sm text-muted-foreground hover:underline">
        ← Produits
      </Link>
      <h1 className="text-2xl font-semibold">Nouveau produit</h1>
      <form onSubmit={form.handleSubmit((d) => execute(d))} className="space-y-4 max-w-sm">
        <div className="space-y-1">
          <Label>Nom *</Label>
          <Input {...form.register('name')} placeholder="ex: Café" />
          {form.formState.errors.name && (
            <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label>Catégorie *</Label>
          <Input {...form.register('category')} placeholder="ex: Boissons" />
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
          <Label>Stock initial</Label>
          <Input type="number" min="0" {...form.register('stock_quantity')} />
          {form.formState.errors.stock_quantity && (
            <p className="text-sm text-destructive">{form.formState.errors.stock_quantity.message}</p>
          )}
        </div>
        <Button type="submit" disabled={status === 'executing'}>
          {status === 'executing' ? 'Création...' : 'Créer le produit'}
        </Button>
      </form>
    </div>
  )
}
