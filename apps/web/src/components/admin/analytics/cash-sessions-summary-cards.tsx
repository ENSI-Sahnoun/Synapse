import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { CashSessionRow, CashSessionsSummary } from '@/data/admin/analytics/cash-sessions'

type Props = {
  currentSession: CashSessionRow | null
  summary: CashSessionsSummary
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function CashSessionsSummaryCards({ currentSession, summary }: Props) {
  const hasTodayDiscrepancy = Math.abs(summary.todayDiscrepancyDt) > 0.001

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Session actuelle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {currentSession ? (
            <>
              <p className="text-xl font-bold">Ouverte</p>
              <p className="text-sm text-muted-foreground">
                Par {currentSession.openedByName} depuis {formatTime(currentSession.openedAt)}
              </p>
              <Badge variant="outline" className="mt-1">
                En direct
              </Badge>
            </>
          ) : (
            <>
              <p className="text-xl font-bold">Fermée</p>
              <p className="text-sm text-muted-foreground">Aucune session en cours</p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Écart total — aujourd&apos;hui</CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className="text-xl font-bold"
            style={hasTodayDiscrepancy ? { color: '#dc2626' } : undefined}
          >
            {summary.todayDiscrepancyDt > 0 ? '+' : ''}
            {summary.todayDiscrepancyDt.toFixed(3)} DT
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Sessions avec écart — cette semaine</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xl font-bold">{summary.nonZeroDiscrepancyCountThisWeek}</p>
        </CardContent>
      </Card>
    </div>
  )
}
