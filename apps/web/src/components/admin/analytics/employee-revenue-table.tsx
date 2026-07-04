import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { EmployeeRevenue, ShiftsSummary } from '@/data/admin/analytics/staff'

type Props = { revenue: EmployeeRevenue[]; shifts: ShiftsSummary[] }

export function EmployeeRevenueTable({ revenue, shifts }: Props) {
  const shiftsMap = new Map(shifts.map((s) => [s.employeeId, s]))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenus par employé</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employé</TableHead>
              <TableHead className="text-right">Transactions</TableHead>
              <TableHead className="text-right">Revenus (DT)</TableHead>
              <TableHead className="text-right">Shifts</TableHead>
              <TableHead className="text-right">Ventes/shift (DT)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {revenue.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Aucune vente sur la période
                </TableCell>
              </TableRow>
            ) : (
              revenue.map((r) => {
                const shift = shiftsMap.get(r.employeeId)
                return (
                  <TableRow key={r.employeeId}>
                    <TableCell>{r.fullName}</TableCell>
                    <TableCell className="text-right">{r.transactions}</TableCell>
                    <TableCell className="text-right font-mono">{r.revenue.toFixed(3)}</TableCell>
                    <TableCell className="text-right">{shift?.shiftsWorked ?? 0}</TableCell>
                    <TableCell className="text-right font-mono">
                      {(shift?.salesPerShift ?? 0).toFixed(3)}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
