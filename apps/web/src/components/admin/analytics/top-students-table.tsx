import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { TopStudentByLoyalty, TopStudentBySpend } from '@/data/admin/analytics/students'

type Props = { byLoyalty: TopStudentByLoyalty[]; bySpend: TopStudentBySpend[] }

export function TopStudentsTable({ byLoyalty, bySpend }: Props) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Top étudiants — points fidélité</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Étudiant</TableHead>
                <TableHead className="text-right">Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byLoyalty.map((s) => (
                <TableRow key={s.studentId}>
                  <TableCell>{s.fullName}</TableCell>
                  <TableCell className="text-right font-mono">{s.points}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top étudiants — dépenses</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Étudiant</TableHead>
                <TableHead className="text-right">Total (DT)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bySpend.map((s) => (
                <TableRow key={s.studentId}>
                  <TableCell>{s.fullName}</TableCell>
                  <TableCell className="text-right font-mono">{s.totalSpend.toFixed(3)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
