import { getProductById } from '@/data/admin/products'
import { notFound } from 'next/navigation'
import { EditProductForm } from './edit-product-form'

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const product = await getProductById(id)
  if (!product) notFound()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Modifier le produit</h1>
      <EditProductForm product={product} />
    </div>
  )
}
