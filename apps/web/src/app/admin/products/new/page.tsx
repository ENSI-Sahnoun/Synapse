import { listProductCategories } from '@/data/admin/product-categories'
import { ProductForm } from '@/components/admin/products/ProductForm'

export default async function NewProductPage() {
  const categories = await listProductCategories()
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Nouveau produit</h1>
      <ProductForm categories={categories} />
    </div>
  )
}
