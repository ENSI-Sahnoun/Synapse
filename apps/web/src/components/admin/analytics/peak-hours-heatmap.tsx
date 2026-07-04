import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PeakHoursPoint } from '@/data/admin/analytics/attendance'

const WEEKDAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

type Props = { data: PeakHoursPoint[] }

export function PeakHoursHeatmap({ data }: Props) {
  const map = new Map<string, number>()
  let max = 0
  data.forEach((p) => {
    map.set(`${p.weekday}-${p.hour}`, p.visits)
    if (p.visits > max) max = p.visits
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Heures de pointe</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="p-1 text-left"></th>
              {HOURS.map((h) => (
                <th key={h} className="p-1 text-center font-normal text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WEEKDAYS.map((label, weekday) => (
              <tr key={weekday}>
                <td className="p-1 font-medium text-muted-foreground">{label}</td>
                {HOURS.map((hour) => {
                  const visits = map.get(`${weekday}-${hour}`) ?? 0
                  const intensity = max > 0 ? visits / max : 0
                  return (
                    <td key={hour} className="p-0.5">
                      <div
                        title={`${visits} visites`}
                        className="h-5 w-5 rounded-sm"
                        style={{ backgroundColor: `rgba(99, 102, 241, ${intensity})` }}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
