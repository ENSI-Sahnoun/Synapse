'use client'

import { useState, useRef } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createProductSchema, updateProductSchema, type CreateProductInput, type UpdateProductInput } from '@/utils/zod-schemas/product'
import { createProductAction, updateProductAction } from '@/actions/admin/products'
import { createCategoryAction, deleteCategoryAction } from '@/actions/admin/product-categories'
import { createClient } from '@/supabase-clients/client'
import type { AdminProduct } from '@/data/admin/products'
import type { ProductCategory } from '@/data/admin/product-categories'
import Link from 'next/link'

type Props = {
  product?: AdminProduct
  categories: ProductCategory[]
}

export function ProductForm({ product, categories: initialCategories }: Props) {
  const router = useRouter()
  const isEdit = !!product
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [categories, setCategories] = useState(initialCategories)
  const [newCatName, setNewCatName] = useState('')
  const [addingCat, setAddingCat] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(product?.image_url ?? null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<CreateProductInput | UpdateProductInput>({
    resolver: zodResolver(isEdit ? updateProductSchema as any : createProductSchema as any),
    defaultValues: isEdit
      ? {
          id: product.id,
          name: product.name,
          category: product.category,
          price_dt: product.price_dt,
          cost_price: product.cost_price ?? undefined,
          supplier: product.supplier ?? undefined,
          barcode: product.barcode ?? undefined,
          image_url: product.image_url ?? undefined,
        }
      : { name: '', category: '', price_dt: 0 },
  })

  const { execute: execCreate, status: createStatus } = useAction(createProductAction, {
    onSuccess: () => { toast.success('Produit créé'); router.push('/admin/products') },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  const { execute: execUpdate, status: updateStatus } = useAction(updateProductAction, {
    onSuccess: () => { toast.success('Produit mis à jour'); router.push('/admin/products') },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  const { execute: execCreateCat } = useAction(createCategoryAction, {
    onSuccess: (result) => {
      toast.success('Catégorie ajoutée')
      // Optimistically add to local list; page refresh will confirm
      if (newCatName.trim()) {
        setCategories((prev) => [...prev, { id: crypto.randomUUID(), name: newCatName.trim() }].sort((a, b) => a.name.localeCompare(b.name)))
        form.setValue('category', newCatName.trim())
      }
      setNewCatName('')
      setAddingCat(false)
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  const { execute: execDeleteCat } = useAction(deleteCategoryAction, {
    onSuccess: ({ input }) => {
      toast.success('Catégorie supprimée')
      setCategories((prev) => prev.filter((c) => c.id !== input.id))
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Impossible de supprimer'),
  })

  async function handleImageUpload(file: File) {
    setUploadingImage(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const path = `${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('product-images').getPublicUrl(path)
      form.setValue('image_url', data.publicUrl)
      setImagePreview(data.publicUrl)
      toast.success('Image téléchargée')
    } catch {
      toast.error('Erreur de téléchargement')
    } finally {
      setUploadingImage(false)
    }
  }

  const submitting = createStatus === 'executing' || updateStatus === 'executing'

  return (
    <div className="space-y-6 max-w-sm">
      <Link href="/admin/products" className="text-sm text-muted-foreground hover:underline">
        ← Produits
      </Link>

      <form
        onSubmit={form.handleSubmit((d) => isEdit ? execUpdate(d as UpdateProductInput) : execCreate(d as CreateProductInput))}
        className="space-y-4"
      >
        {/* Hidden fields */}
        {isEdit && <input type="hidden" {...form.register('id')} />}
        <input type="hidden" {...form.register('image_url')} />

        {/* Photo */}
        <div className="space-y-2">
          <Label>Photo</Label>
          <div
            className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {imagePreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagePreview} alt="Aperçu" className="h-28 w-28 rounded object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-1 text-muted-foreground text-sm">
                <span className="text-2xl">📷</span>
                <span>Cliquer pour ajouter une photo</span>
              </div>
            )}
            {uploadingImage && <p className="text-xs text-muted-foreground">Téléchargement...</p>}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f) }}
          />
          {imagePreview && (
            <button
              type="button"
              className="text-xs text-destructive hover:underline"
              onClick={() => { form.setValue('image_url', null); setImagePreview(null) }}
            >
              Supprimer la photo
            </button>
          )}
        </div>

        {/* Name */}
        <div className="space-y-1">
          <Label>Nom *</Label>
          <Input {...form.register('name')} placeholder="ex: Café" />
          {form.formState.errors.name && (
            <p className="text-sm text-destructive">{(form.formState.errors.name as any).message}</p>
          )}
        </div>

        {/* Category select */}
        <div className="space-y-1">
          <Label>Catégorie *</Label>
          <div className="flex gap-2">
            <select
              {...form.register('category')}
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">— Choisir —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
            <Button type="button" variant="outline" size="sm" onClick={() => setAddingCat((v) => !v)}>
              {addingCat ? '✕' : '+'}
            </Button>
          </div>
          {form.formState.errors.category && (
            <p className="text-sm text-destructive">{(form.formState.errors.category as any).message}</p>
          )}

          {/* Add category inline */}
          {addingCat && (
            <div className="flex gap-2 mt-2">
              <Input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Nouvelle catégorie"
                className="flex-1"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (newCatName.trim()) execCreateCat({ name: newCatName.trim() }) } }}
              />
              <Button
                type="button"
                size="sm"
                disabled={!newCatName.trim()}
                onClick={() => { if (newCatName.trim()) execCreateCat({ name: newCatName.trim() }) }}
              >
                Ajouter
              </Button>
            </div>
          )}

          {/* Remove categories */}
          {categories.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {categories.map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                >
                  {c.name}
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => execDeleteCat({ id: c.id })}
                    title="Supprimer cette catégorie"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Price */}
        <div className="space-y-1">
          <Label>Prix (DT) *</Label>
          <Input type="number" step="0.1" min="0" {...form.register('price_dt')} />
          {form.formState.errors.price_dt && (
            <p className="text-sm text-destructive">{(form.formState.errors.price_dt as any).message}</p>
          )}
        </div>

        {/* Cost price */}
        <div className="space-y-1">
          <Label>Coût d&apos;achat (DT)</Label>
          <Input type="number" step="0.1" min="0" {...form.register('cost_price')} placeholder="ex: 0.8" />
          {form.formState.errors.cost_price && (
            <p className="text-sm text-destructive">{(form.formState.errors.cost_price as any).message}</p>
          )}
          {Number(form.watch('price_dt')) > 0 && Number(form.watch('cost_price')) > 0 && (
            <p className="text-xs text-muted-foreground">
              Marge: {(Number(form.watch('price_dt')) - Number(form.watch('cost_price'))).toFixed(3)} DT
            </p>
          )}
        </div>

        {/* Supplier */}
        <div className="space-y-1">
          <Label>Fournisseur</Label>
          <Input {...form.register('supplier')} placeholder="ex: Grossiste Ariana" />
        </div>

        {/* Barcode */}
        <div className="space-y-1">
          <Label>Code-barres</Label>
          <Input {...form.register('barcode')} placeholder="ex: 6191234567890" />
        </div>

        {/* Stock (read-only, restock happens via dedicated action) */}
        {isEdit && (
          <div className="space-y-1">
            <Label>Stock actuel</Label>
            <p className="text-sm">{product.stock_quantity} unité(s)</p>
            <p className="text-xs text-muted-foreground">
              Utilisez le bouton &quot;Réapprovisionner&quot; sur la page produits pour ajouter du stock.
            </p>
          </div>
        )}

        <Button type="submit" disabled={submitting || uploadingImage}>
          {submitting ? 'Enregistrement...' : isEdit ? 'Enregistrer' : 'Créer le produit'}
        </Button>
      </form>
    </div>
  )
}
