import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { RestockEvent } from '@/data/admin/analytics/pos'

type Props = { data: RestockEvent[] }

export function RestockHistoryTable({ data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Historique de réapprovisionnement</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Produit</TableHead>
              <TableHead className="text-right">Quantité</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Aucun réapprovisionnement sur la période
                </TableCell>
              </TableRow>
            ) : (
              data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.createdAt).toLocaleString('fr-FR')}</TableCell>
                  <TableCell>{r.productName}</TableCell>
                  <TableCell className="text-right">+{r.quantity}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
