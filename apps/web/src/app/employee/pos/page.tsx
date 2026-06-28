import { listActiveProducts } from '@/data/employee/products'
import { PosClient } from './pos-client'

export default async function PosPage() {
  const products = await listActiveProducts()
  return <PosClient products={products} />
}
