'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CustomMetricRow } from '@/data/admin/dashboard'

type Props = { metrics: CustomMetricRow[] }

export function CustomMetricsChart({ metrics }: Props) {
  if (metrics.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Métriques personnalisées</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {metrics.map((m) => {
          const pct =
            m.target_value && m.target_value > 0
              ? Math.min((m.current_value / m.target_value) * 100, 150)
              : null
          const chartData = [{ name: m.name, valeur: m.current_value }]

          return (
            <div key={m.id}>
              <p className="mb-1 text-sm font-medium">
                {m.name}{' '}
                <span className="text-muted-foreground">
                  ({m.current_value} {m.unit}
                  {m.target_value ? ` / cible: ${m.target_value}` : ''})
                </span>
              </p>
              <ResponsiveContainer width="100%" height={60}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, m.target_value ? m.target_value * 1.2 : 'auto']}
                    hide
                  />
                  <YAxis type="category" dataKey="name" hide />
                  <Tooltip formatter={(v: number) => [`${v} ${m.unit}`, m.name]} />
                  <Bar dataKey="valeur" radius={[0, 4, 4, 0]}>
                    <Cell fill={pct !== null && pct >= 100 ? '#22c55e' : '#6366f1'} />
                  </Bar>
                  {m.target_value && (
                    <ReferenceLine x={m.target_value} stroke="#ef4444" strokeDasharray="4 2" />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
