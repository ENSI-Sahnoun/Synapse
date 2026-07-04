import { listAllProducts } from '@/data/admin/products'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArchiveProductButton, RestoreProductButton, DeleteProductButton } from './product-actions'
import { RestockDialog } from '@/components/admin/products/RestockDialog'

export const dynamic = 'force-dynamic'

export default async function AdminProductsPage() {
  const products = await listAllProducts()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Produits (POS)</h1>
        <Button asChild>
          <Link href="/admin/products/new">Nouveau produit</Link>
        </Button>
      </div>

      <div className="border rounded-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2 w-12"></th>
              <th className="text-left px-4 py-2">Nom</th>
              <th className="text-left px-4 py-2">Catégorie</th>
              <th className="text-left px-4 py-2">Prix (DT)</th>
              <th className="text-left px-4 py-2">Stock</th>
              <th className="text-left px-4 py-2">Statut</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="px-4 py-2">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.name} className="h-9 w-9 rounded object-cover" />
                  ) : (
                    <div className="h-9 w-9 rounded bg-muted flex items-center justify-center text-muted-foreground text-xs">—</div>
                  )}
                </td>
                <td className="px-4 py-2 font-medium">{p.name}</td>
                <td className="px-4 py-2 text-muted-foreground">{p.category}</td>
                <td className="px-4 py-2">{Number(p.price_dt).toFixed(2)}</td>
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
            {products.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Aucun produit
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
