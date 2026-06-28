import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { LiveSnapshot } from '@/data/admin/dashboard'

type Props = { products: LiveSnapshot['lowStockProducts'] }

export function LowStockPanel({ products }: Props) {
  if (products.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Stock faible</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {products.map((p) => (
            <li key={p.id} className="flex items-center justify-between text-sm">
              <span>{p.name}</span>
              <Badge variant={p.stock_quantity === 0 ? 'destructive' : 'secondary'}>
                {p.stock_quantity === 0 ? 'Rupture' : `${p.stock_quantity} restants`}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
