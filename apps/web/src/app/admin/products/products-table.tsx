'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArchiveProductButton, RestoreProductButton, DeleteProductButton } from './product-actions'
import { RestockDialog } from '@/components/admin/products/RestockDialog'
import { PriceHistoryDialog } from '@/components/admin/products/PriceHistoryDialog'
import { reorderProductsAction } from '@/actions/admin/products'
import { reorderCategoriesAction } from '@/actions/admin/product-categories'
import type { AdminProduct } from '@/data/admin/products'

interface Props {
  products: AdminProduct[]
  categoryEmojis: Record<string, string>
  categoryOrder: { id: string; name: string }[]
}

export function ProductsTable({ products, categoryEmojis, categoryOrder }: Props) {
  const [query, setQuery] = useState('')
  // Local source of truth for order; array order = display order.
  const [items, setItems] = useState(products)
  const [cats, setCats] = useState(categoryOrder)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragCatId, setDragCatId] = useState<string | null>(null)

  const { execute: persistOrder } = useAction(reorderProductsAction, {
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur lors du réordonnancement'),
  })
  const { execute: persistCatOrder } = useAction(reorderCategoriesAction, {
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur lors du réordonnancement'),
  })

  const searching = query.trim().length > 0

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? items.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
      : items
    const byCategory = new Map<string, AdminProduct[]>()
    for (const p of filtered) {
      const list = byCategory.get(p.category) ?? []
      list.push(p)
      byCategory.set(p.category, list)
    }
    // order groups by the category sort order; unknown categories fall to the end
    const rank = new Map(cats.map((c, i) => [c.name, i]))
    return [...byCategory.entries()].sort(
      (a, b) => (rank.get(a[0]) ?? 999) - (rank.get(b[0]) ?? 999)
    )
  }, [items, query, cats])

  const total = groups.reduce((sum, [, list]) => sum + list.length, 0)

  function handleDragOver(overId: string, category: string) {
    if (!dragId || dragId === overId) return
    setItems((prev) => {
      const dragged = prev.find((p) => p.id === dragId)
      const over = prev.find((p) => p.id === overId)
      // only reorder within the same category
      if (!dragged || !over || dragged.category !== category || over.category !== category) return prev
      const without = prev.filter((p) => p.id !== dragId)
      const overIdx = without.findIndex((p) => p.id === overId)
      without.splice(overIdx, 0, dragged)
      return without
    })
  }

  function handleDrop(category: string) {
    const ids = items.filter((p) => p.category === category).map((p) => p.id)
    setDragId(null)
    if (ids.length > 1) persistOrder({ ids })
  }

  function handleCatDragOver(overId: string) {
    if (!dragCatId || dragCatId === overId) return
    setCats((prev) => {
      const dragged = prev.find((c) => c.id === dragCatId)
      if (!dragged) return prev
      const without = prev.filter((c) => c.id !== dragCatId)
      const overIdx = without.findIndex((c) => c.id === overId)
      without.splice(overIdx, 0, dragged)
      return without
    })
  }

  function handleCatDrop() {
    setDragCatId(null)
    if (cats.length > 1) persistCatOrder({ ids: cats.map((c) => c.id) })
  }

  return (
    <div className="space-y-4">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher un produit ou une catégorie…"
        className="max-w-sm"
      />
      {!searching && (
        <p className="text-xs text-muted-foreground">Glissez une ligne pour réordonner (par catégorie).</p>
      )}

      {total === 0 ? (
        <AnimatePresence mode="wait">
          <motion.div
            key={products.length === 0 ? 'no-products' : 'no-results'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="border rounded-md px-4 py-8 text-center text-muted-foreground"
          >
            {products.length === 0 ? 'Aucun produit' : 'Aucun résultat'}
          </motion.div>
        </AnimatePresence>
      ) : (
        groups.map(([category, list]) => {
          const catId = cats.find((c) => c.name === category)?.id
          return (
          <div key={category} className="border rounded-md overflow-hidden">
            <div
              draggable={!searching && !!catId}
              onDragStart={() => catId && setDragCatId(catId)}
              onDragOver={(e) => { if (!searching && catId && dragCatId) { e.preventDefault(); handleCatDragOver(catId) } }}
              onDrop={() => { if (!searching && dragCatId) handleCatDrop() }}
              onDragEnd={() => setDragCatId(null)}
              className={`flex items-center gap-2 bg-muted/50 px-4 py-2 font-medium ${!searching ? 'cursor-move' : ''} ${dragCatId === catId ? 'opacity-40' : ''}`}
            >
              {!searching && <span className="text-muted-foreground select-none">⠿</span>}
              <span className="text-lg">{categoryEmojis[category] ?? '📦'}</span>
              <span>{category}</span>
              <span className="text-muted-foreground text-sm">({list.length})</span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {list.map((p) => (
                  <tr
                    key={p.id}
                    draggable={!searching}
                    onDragStart={() => setDragId(p.id)}
                    onDragOver={(e) => { if (!searching) { e.preventDefault(); handleDragOver(p.id, category) } }}
                    onDrop={() => { if (!searching && dragId) handleDrop(category) }}
                    onDragEnd={() => setDragId(null)}
                    className={`border-t ${dragId === p.id ? 'opacity-40' : ''} ${!searching ? 'cursor-move' : ''}`}
                  >
                    <td className="px-2 py-2 w-6 text-center text-muted-foreground select-none">
                      {!searching && '⠿'}
                    </td>
                    <td className="px-2 py-2 w-12">
                      {p.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image_url} alt={p.name} className="h-9 w-9 rounded object-cover" />
                      ) : (
                        <div className="h-9 w-9 rounded bg-muted flex items-center justify-center text-lg">
                          {categoryEmojis[p.category] ?? '📦'}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 font-medium">{p.name}</td>
                    <td className="px-4 py-2">{Number(p.price_dt).toFixed(2)} DT</td>
                    <td className="px-4 py-2">
                      <span className={p.stock_quantity <= 5 ? 'text-destructive font-medium' : ''}>
                        {p.stock_quantity}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                        {p.is_active ? 'Actif' : 'Archivé'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2 justify-end">
                        <PriceHistoryDialog productId={p.id} productName={p.name} />
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/products/${p.id}/edit`}>Modifier</Link>
                        </Button>
                        <RestockDialog product={p} />
                        {p.is_active ? (
                          <ArchiveProductButton id={p.id} />
                        ) : (
                          <RestoreProductButton id={p.id} />
                        )}
                        <DeleteProductButton id={p.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )
        })
      )}
    </div>
  )
}
