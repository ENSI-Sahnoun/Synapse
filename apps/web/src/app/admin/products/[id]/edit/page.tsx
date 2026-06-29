import { getProductById } from '@/data/admin/products'
import { listProductCategories } from '@/data/admin/product-categories'
import { notFound } from 'next/navigation'
import { ProductForm } from '@/components/admin/products/ProductForm'

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [product, categories] = await Promise.all([getProductById(id), listProductCategories()])
  if (!product) notFound()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Modifier le produit</h1>
      <ProductForm product={product} categories={categories} />
    </div>
  )
}
