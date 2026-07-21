import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/user/UserAvatar'
import type { CashSessionRow } from '@/data/admin/analytics/cash-sessions'

type Props = { data: CashSessionRow[] }

function formatDuration(openedAt: string, closedAt: string | null) {
  const start = new Date(openedAt).getTime()
  const end = closedAt ? new Date(closedAt).getTime() : Date.now()
  const minutes = Math.max(0, Math.round((end - start) / 60000))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m} min`
}

export function CashSessionsTable({ data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Historique des sessions de caisse</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Ouverte par</TableHead>
              <TableHead>Clôturée par</TableHead>
              <TableHead className="text-right">Fond initial (DT)</TableHead>
              <TableHead className="text-right">Compté (DT)</TableHead>
              <TableHead className="text-right">Attendu (DT)</TableHead>
              <TableHead className="text-right">Écart (DT)</TableHead>
              <TableHead className="text-right">Durée</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Aucune session sur la période
                </TableCell>
              </TableRow>
            ) : (
              data.map((r) => {
                const hasDiscrepancy = r.discrepancyDt !== null && Math.abs(r.discrepancyDt) > 0.001
                return (
                  <TableRow key={r.id}>
                    <TableCell>{new Date(r.openedAt).toLocaleString('fr-FR')}</TableCell>
                    <TableCell className="flex items-center gap-2">
                      <UserAvatar fullName={r.openedByName} avatarUrl={r.openedByAvatarUrl} className="h-6 w-6" />
                      {r.openedByName}
                    </TableCell>
                    <TableCell>
                      {r.closedByName ? (
                        <div className="flex items-center gap-2">
                          <UserAvatar fullName={r.closedByName} avatarUrl={r.closedByAvatarUrl} className="h-6 w-6" />
                          {r.closedByName}
                        </div>
                      ) : (
                        <Badge variant="outline">Ouverte</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">{r.openingAmountDt.toFixed(3)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {r.closingAmountDt === null ? '—' : r.closingAmountDt.toFixed(3)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {r.expectedAmountDt === null ? '—' : r.expectedAmountDt.toFixed(3)}
                    </TableCell>
                    <TableCell
                      className="text-right font-mono"
                      style={hasDiscrepancy ? { color: '#dc2626', fontWeight: 700 } : undefined}
                    >
                      {r.discrepancyDt === null ? '—' : r.discrepancyDt.toFixed(3)}
                    </TableCell>
                    <TableCell className="text-right">{formatDuration(r.openedAt, r.closedAt)}</TableCell>
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
