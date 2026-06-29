import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { PnlSummary } from '@/data/admin/accounting'

type Props = { pnl: PnlSummary }

export function PnlTable({ pnl }: Props) {
  const incomeRows = pnl.rows.filter((r) => r.type === 'income')
  const expenseRows = pnl.rows.filter((r) => r.type === 'expense')

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Revenus
        </h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Catégorie</TableHead>
              <TableHead className="text-right">Total (DT)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {incomeRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-muted-foreground">
                  Aucun revenu sur la période
                </TableCell>
              </TableRow>
            ) : (
              incomeRows.map((r) => (
                <TableRow key={r.category_id}>
                  <TableCell>
                    <Badge variant="outline" className="border-green-500 text-green-700">
                      {r.category_name}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{r.total.toFixed(3)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-bold">Total revenus</TableCell>
              <TableCell className="text-right font-bold font-mono">
                {pnl.totalRevenue.toFixed(3)} DT
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Dépenses
        </h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Catégorie</TableHead>
              <TableHead className="text-right">Total (DT)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenseRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-muted-foreground">
                  Aucune dépense sur la période
                </TableCell>
              </TableRow>
            ) : (
              expenseRows.map((r) => (
                <TableRow key={r.category_id}>
                  <TableCell>
                    <Badge variant="outline" className="border-red-400 text-red-700">
                      {r.category_name}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{r.total.toFixed(3)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-bold">Total dépenses</TableCell>
              <TableCell className="text-right font-bold font-mono">
                {pnl.totalExpenses.toFixed(3)} DT
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      <div
        className={`rounded-lg border-2 p-4 ${
          pnl.profit >= 0 ? 'border-green-500 bg-green-50' : 'border-red-400 bg-red-50'
        }`}
      >
        <p className="text-sm font-medium text-muted-foreground">Résultat net</p>
        <p
          className={`text-3xl font-bold ${
            pnl.profit >= 0 ? 'text-green-700' : 'text-red-700'
          }`}
        >
          {pnl.profit >= 0 ? '+' : ''}
          {pnl.profit.toFixed(3)} DT
        </p>
      </div>
    </div>
  )
}
