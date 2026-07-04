import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { StockSnapshotRow } from '@/data/admin/analytics/pos'

export function StockSnapshotTable({ rows, from, to }: { rows: StockSnapshotRow[]; from: string; to: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stock sur la période ({from} → {to})</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead className="text-right">Début</TableHead>
              <TableHead className="text-right">Fin</TableHead>
              <TableHead className="text-right">Δ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Aucun produit
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.category}</TableCell>
                  <TableCell className="text-right font-mono">{r.startStock}</TableCell>
                  <TableCell className={`text-right font-mono ${r.endStock <= 5 ? 'text-destructive font-medium' : ''}`}>
                    {r.endStock}
                  </TableCell>
                  <TableCell className={`text-right font-mono ${r.delta > 0 ? 'text-green-600' : r.delta < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {r.delta > 0 ? `+${r.delta}` : r.delta}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
