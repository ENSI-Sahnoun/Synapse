import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PlanRevenue } from '@/data/admin/analytics/subscriptions'

type Props = { data: PlanRevenue[] }

export function RevenuePerPlanTable({ data }: Props) {
  const total = data.reduce((s, d) => s + d.revenue, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenus par formule</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Formule</TableHead>
              <TableHead className="text-right">Ventes</TableHead>
              <TableHead className="text-right">Revenus (DT)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Aucune vente sur la période
                </TableCell>
              </TableRow>
            ) : (
              data.map((r) => (
                <TableRow key={r.planName}>
                  <TableCell>{r.planName}</TableCell>
                  <TableCell className="text-right">{r.count}</TableCell>
                  <TableCell className="text-right font-mono">{r.revenue.toFixed(3)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-bold">Total</TableCell>
              <TableCell />
              <TableCell className="text-right font-bold font-mono">{total.toFixed(3)} DT</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  )
}
