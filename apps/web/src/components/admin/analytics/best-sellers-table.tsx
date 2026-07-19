import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { BestSeller } from '@/data/admin/analytics/pos'

type Props = { data: BestSeller[] }

export function BestSellersTable({ data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Meilleures ventes</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead className="text-right">Qté vendue</TableHead>
              <TableHead className="text-right">Revenus (DT)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="animate-in fade-in duration-200 text-center text-muted-foreground">
                  Aucune vente sur la période
                </TableCell>
              </TableRow>
            ) : (
              data.map((r) => (
                <TableRow key={r.productId}>
                  <TableCell>{r.productName}</TableCell>
                  <TableCell className="text-right">{r.quantitySold}</TableCell>
                  <TableCell className="text-right font-mono">{r.revenue.toFixed(3)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
